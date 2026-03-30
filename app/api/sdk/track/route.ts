import { db } from "@/lib/db"
import { scores } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { trackUsage } from "@/lib/usage"
import { authenticateSDK } from "@/lib/auth-sdk"

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

  return NextResponse.json({ id: score.id, evalStatus: score.evalStatus })
}
