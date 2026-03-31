// app/api/compositions/[id]/assemble/route.ts
import { db } from "@/lib/db"
import { blocks, compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"
import { assembleGraph } from "@/lib/graph-engine"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const { graph } = body

  if (!graph?.nodes || !graph?.edges) {
    return NextResponse.json({ error: "graph with nodes and edges is required" }, { status: 400 })
  }

  const [comp] = await db
    .select()
    .from(compositions)
    .where(and(eq(compositions.id, id), eq(compositions.teamId, orgId)))

  if (!comp) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const teamBlocks = await db.select().from(blocks).where(eq(blocks.teamId, orgId))
  const blockLookup: Record<string, { content: string; name: string; role?: string | null; kind?: string; description?: string | null }> = {}
  for (const b of teamBlocks) {
    blockLookup[b.id] = { content: b.content, name: b.name, role: b.role, kind: b.kind, description: b.description }
  }

  const result = assembleGraph(graph.nodes, graph.edges, blockLookup, {})

  return NextResponse.json({
    text: result.text,
    messages: result.messages,
    blocks: result.blocks,
    tools: result.tools,
  })
}
