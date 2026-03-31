import { db } from "@/lib/db"
import { blocks, compositions, deployments, assemblyLogs } from "@/lib/schema"
import { eq, and, desc } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticateSDK } from "@/lib/auth-sdk"
import { checkRateLimit } from "@/lib/rate-limit"
import { trackUsage } from "@/lib/usage"
import { assembleGraph } from "@/lib/graph-engine"

export async function POST(req: Request) {
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

  void trackUsage(apiKey.teamId, "compose")

  const body = await req.json()
  const { composition: compositionName, context: userContext = {} } = body

  if (!compositionName) {
    return NextResponse.json({ error: "composition name is required" }, { status: 400 })
  }

  // Look up composition by name
  const teamCompositions = await db
    .select()
    .from(compositions)
    .where(and(eq(compositions.teamId, apiKey.teamId), eq(compositions.name, compositionName)))

  const comp = teamCompositions[0]
  if (!comp) {
    return NextResponse.json({ error: `Composition "${compositionName}" not found` }, { status: 404 })
  }

  // Check for deployed version in this environment
  const envDeployments = await db
    .select()
    .from(deployments)
    .where(and(eq(deployments.compositionId, comp.id), eq(deployments.environment, apiKey.environment)))
    .orderBy(desc(deployments.deployedAt))
    .limit(1)

  const activeVersion = envDeployments[0]?.version ?? comp.version

  // Get all blocks for this team
  const teamBlocks = await db
    .select()
    .from(blocks)
    .where(eq(blocks.teamId, apiKey.teamId))

  const blockLookup: Record<string, { name: string; content: string }> = {}
  for (const b of teamBlocks) {
    blockLookup[b.id] = { name: b.name, content: b.content }
  }

  // Auto-inject metadata
  const now = new Date()
  const fullContext: Record<string, any> = {
    ...userContext,
    _time: {
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      date: now.toISOString().split("T")[0],
      timestamp: now.toISOString(),
    },
    _env: { name: apiKey.environment },
    _sdk: { version: "1", language: "rest" },
    _req: {
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
      ...(userContext._req ?? {}),
    },
  }

  // Compose
  const graph = comp.graph as { nodes: any[]; edges: any[] }
  const result = assembleGraph(graph.nodes, graph.edges, blockLookup, fullContext)

  const assemblyId = `asm_${crypto.randomUUID()}`

  // Write assembly log
  await db.insert(assemblyLogs).values({
    teamId: apiKey.teamId,
    compositionId: comp.id,
    compositionVersion: activeVersion,
    environment: apiKey.environment,
    context: fullContext,
    resolvedBlocks: result.blocks,
    variantId: result.variantId,
    tokenCount: result.tokenCount,
    assemblyId,
  })

  return NextResponse.json({
    id: assemblyId,
    text: result.text,
    version: `v${activeVersion}`,
    variantId: result.variantId,
    tokenCount: result.tokenCount,
    blocks: result.blocks,
    compositionName: comp.name,
  })
}
