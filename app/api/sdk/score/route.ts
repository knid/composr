import { db } from "@/lib/db"
import { apiKeys, scores } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import crypto from "crypto"
import { checkRateLimit } from "@/lib/rate-limit"
import { trackUsage } from "@/lib/usage"

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

  void trackUsage(apiKey.teamId, "score")

  const body = await req.json()
  const { assemblyId, metrics } = body

  if (!assemblyId) {
    return NextResponse.json({ error: "assemblyId is required" }, { status: 400 })
  }

  const [existing] = await db
    .select()
    .from(scores)
    .where(eq(scores.assemblyId, assemblyId))

  if (existing) {
    const [updated] = await db
      .update(scores)
      .set({ manualScores: metrics ?? {} })
      .where(eq(scores.assemblyId, assemblyId))
      .returning({ id: scores.id })

    return NextResponse.json({ id: updated.id })
  }

  // No existing row — create a minimal one with evalStatus "skipped"
  const [created] = await db
    .insert(scores)
    .values({
      teamId: apiKey.teamId,
      assemblyId,
      compositionId: "00000000-0000-0000-0000-000000000000",
      compositionVersion: 0,
      environment: "prod",
      manualScores: metrics ?? {},
      evalStatus: "skipped",
    })
    .returning({ id: scores.id })

  return NextResponse.json({ id: created.id })
}
