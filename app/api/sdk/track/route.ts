import { db } from "@/lib/db"
import { apiKeys, scores } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import crypto from "crypto"
import { checkRateLimit } from "@/lib/rate-limit"

async function authenticateSDK(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  const key = authHeader.slice(7)
  const hash = crypto.createHash("sha256").update(key).digest("hex")

  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))

  return apiKey ?? null
}

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
