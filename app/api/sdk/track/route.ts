import { db } from "@/lib/db"
import { scores, assemblyLogs, evalConfigs } from "@/lib/schema"
import { eq, and, desc } from "drizzle-orm"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { trackUsage } from "@/lib/usage"
import { authenticateSDK } from "@/lib/auth-sdk"
import { runEval, runStructuredOutputEval, runCodeEval } from "@/lib/eval-runner"

export async function POST(req: Request) {
  const apiKey = await authenticateSDK(req)
  if (!apiKey) return NextResponse.json({ error: "Invalid API key" }, { status: 401 })

  const rateLimit = checkRateLimit(`sdk:${apiKey.id}`, 500, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": String(rateLimit.remaining),
          "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
          "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      }
    )
  }

  void trackUsage(apiKey.teamId, "track")

  const body = await req.json()
  const {
    assemblyId,
    input,
    output,
    model,
    latencyMs,
    compositionId,
    compositionVersion,
    environment,
    variantId,
    context,
  } = body

  if (!assemblyId || !compositionId || !compositionVersion || !environment) {
    return NextResponse.json(
      { error: "assemblyId, compositionId, compositionVersion, and environment are required" },
      { status: 400 }
    )
  }

  const [score] = await db
    .insert(scores)
    .values({
      teamId: apiKey.teamId,
      assemblyId,
      compositionId,
      compositionVersion,
      environment,
      variantId: variantId ?? null,
      context: context ?? null,
      input: input ?? null,
      output: output ?? null,
      model: model ?? null,
      latencyMs: latencyMs ?? null,
      evalStatus: "pending",
    })
    .returning({ id: scores.id, evalStatus: scores.evalStatus })

  // Write assembly log if we have the data
  if (body.resolvedBlocks) {
    await db.insert(assemblyLogs).values({
      teamId: apiKey.teamId,
      compositionId,
      compositionVersion,
      environment,
      context: context ?? {},
      resolvedBlocks: body.resolvedBlocks ?? [],
      variantId: variantId ?? null,
      tokenCount: body.tokenCount ?? null,
      assemblyId: assemblyId ?? null,
    })
  }

  // Trigger auto-eval asynchronously (non-blocking)
  void triggerAutoEval(score.id, apiKey.teamId, compositionId, input, output)

  return NextResponse.json({ id: score.id, evalStatus: score.evalStatus })
}

async function triggerAutoEval(
  scoreId: string,
  teamId: string,
  compositionId: string,
  input: string | null,
  output: string | null,
) {
  if (!input || !output) return

  try {
    const configs = await db
      .select()
      .from(evalConfigs)
      .where(and(
        eq(evalConfigs.compositionId, compositionId),
        eq(evalConfigs.enabled, true),
      ))

    if (configs.length === 0) return

    const roll = Math.floor(Math.random() * 100) + 1
    const configsToRun = configs.filter(c => roll <= c.sampleRate)
    if (configsToRun.length === 0) {
      await db.update(scores).set({ evalStatus: "skipped" }).where(eq(scores.id, scoreId))
      return
    }

    const [assemblyLog] = await db
      .select()
      .from(assemblyLogs)
      .where(eq(assemblyLogs.compositionId, compositionId))
      .orderBy(desc(assemblyLogs.assembledAt))
      .limit(1)

    const systemPrompt = assemblyLog ? "Composition: " + compositionId : ""

    const autoScores: Record<string, { score: number; reasoning: string }> = {}

    for (const config of configsToRun) {
      let result
      if (config.type === "structured_output") {
        result = runStructuredOutputEval(output)
      } else if (config.type === "code") {
        result = runCodeEval(config.judgePrompt ?? "", input, output)
      } else {
        result = await runEval(
          config.scorerName,
          { input, output, systemPrompt },
          config.judgeModel,
          config.judgePrompt ?? undefined,
        )
      }
      autoScores[config.scorerName] = { score: result.score, reasoning: result.reasoning }
    }

    const scoreValues = Object.values(autoScores).map(s => s.score)
    const overallScore = scoreValues.length > 0
      ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
      : null

    await db.update(scores).set({
      autoScores,
      overallScore,
      evalStatus: "completed",
    }).where(eq(scores.id, scoreId))
  } catch {
    await db.update(scores).set({ evalStatus: "failed" }).where(eq(scores.id, scoreId)).catch(() => {})
  }
}
