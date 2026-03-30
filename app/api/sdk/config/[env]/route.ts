import { db } from "@/lib/db"
import { blocks, compositions, deployments, apiKeys } from "@/lib/schema"
import { eq, desc } from "drizzle-orm"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { trackUsage } from "@/lib/usage"
import { getCached, setCached } from "@/lib/config-cache"
import { authenticateSDK } from "@/lib/auth-sdk"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ env: string }> }
) {
  const apiKey = await authenticateSDK(req)
  if (!apiKey) return NextResponse.json({ error: "Invalid API key" }, { status: 401 })

  const rateLimit = checkRateLimit(`sdk:${apiKey.id}`, 100, 60_000)
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

  void trackUsage(apiKey.teamId, "config")

  const { env } = await params
  const teamId = apiKey.teamId

  const cacheKey = `config:${teamId}:${env}`
  const cached = getCached(cacheKey)
  if (cached) {
    return NextResponse.json(cached)
  }

  // Get all blocks for this team
  const teamBlocks = await db
    .select()
    .from(blocks)
    .where(eq(blocks.teamId, teamId))

  const blockLookup: Record<string, { name: string; content: string; version: number }> = {}
  for (const b of teamBlocks) {
    blockLookup[b.id] = { name: b.name, content: b.content, version: b.version }
  }

  // Get all compositions for this team
  const teamCompositions = await db
    .select()
    .from(compositions)
    .where(eq(compositions.teamId, teamId))

  // Get latest deployment per composition for this env
  const activeDeployments = await db
    .select()
    .from(deployments)
    .where(eq(deployments.environment, env as "dev" | "staging" | "prod"))
    .orderBy(desc(deployments.deployedAt))

  const deployedVersions = new Map<string, number>()
  for (const d of activeDeployments) {
    if (!deployedVersions.has(d.compositionId)) {
      deployedVersions.set(d.compositionId, d.version)
    }
  }

  const compositionConfigs = teamCompositions.map((c) => ({
    id: c.id,
    name: c.name,
    version: deployedVersions.get(c.id) ?? c.version,
    graph: c.graph,
    contextSchema: c.contextSchema,
  }))

  const result = { version: Date.now().toString(), environment: env, blocks: blockLookup, compositions: compositionConfigs }
  setCached(cacheKey, result, 10_000)
  return NextResponse.json(result)
}
