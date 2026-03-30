import { db } from "@/lib/db"
import { scores, evalConfigs } from "@/lib/schema"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"
import { runEval } from "@/lib/eval-runner"

export async function POST(req: Request) {
  const body = await req.json()
  const { scoreId } = body

  if (!scoreId) {
    return NextResponse.json({ error: "scoreId is required" }, { status: 400 })
  }

  // Look up the score row
  const [score] = await db
    .select()
    .from(scores)
    .where(eq(scores.id, scoreId))

  if (!score) {
    return NextResponse.json({ error: "Score not found" }, { status: 404 })
  }

  // Get eval configs for this composition
  const configs = await db
    .select()
    .from(evalConfigs)
    .where(
      and(
        eq(evalConfigs.compositionId, score.compositionId),
        eq(evalConfigs.enabled, true)
      )
    )

  if (configs.length === 0) {
    // No configs — mark as skipped
    await db
      .update(scores)
      .set({ evalStatus: "skipped" })
      .where(eq(scores.id, scoreId))

    return NextResponse.json({ status: "skipped", reason: "no eval configs" })
  }

  const evalInput = {
    input: score.input ?? "",
    output: score.output ?? "",
    systemPrompt: "",
  }

  const autoScores: Record<string, { score: number; reasoning: string; error?: string }> = {}
  const weightedScores: { score: number; weight: number }[] = []

  for (const config of configs) {
    // Check sample rate: only run if random % < sampleRate
    const rand = Math.random() * 100
    if (rand >= config.sampleRate) {
      continue
    }

    const result = await runEval(
      config.scorerName,
      evalInput,
      config.judgeModel ?? undefined,
      config.judgePrompt ?? undefined
    )

    autoScores[config.scorerName] = {
      score: result.score,
      reasoning: result.reasoning,
      ...(result.error ? { error: result.error } : {}),
    }

    if (!result.error) {
      weightedScores.push({ score: result.score, weight: config.weight })
    }
  }

  // Compute weighted average overall score
  let overallScore: number | null = null
  if (weightedScores.length > 0) {
    const totalWeight = weightedScores.reduce((sum, ws) => sum + ws.weight, 0)
    const weightedSum = weightedScores.reduce((sum, ws) => sum + ws.score * ws.weight, 0)
    overallScore = Math.round(weightedSum / totalWeight)
  }

  await db
    .update(scores)
    .set({
      autoScores,
      overallScore,
      evalStatus: "completed",
    })
    .where(eq(scores.id, scoreId))

  return NextResponse.json({ status: "completed", autoScores, overallScore })
}
