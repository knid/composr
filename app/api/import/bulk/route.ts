import { db } from "@/lib/db"
import { blocks, blockVersions, compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"
import { configEvents } from "@/lib/config-events"
import { invalidateTeam } from "@/lib/config-cache"

interface BlockInput {
  name: string
  content: string
  description?: string
  role?: string | null
  tags?: string[]
}

interface CompositionInput {
  name: string
  description?: string
  blockOrder: string[] // block names in order
}

export async function POST(req: Request) {
  const { orgId, userId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const blockInputs: BlockInput[] = body.blocks ?? []
  const compositionInput: CompositionInput | undefined = body.composition

  if (blockInputs.length === 0) {
    return NextResponse.json({ error: "At least one block is required" }, { status: 400 })
  }

  const createdBlocks: Array<{ id: string; name: string }> = []

  for (const input of blockInputs) {
    if (!input.name?.trim() || input.content === undefined) continue

    const [block] = await db.insert(blocks).values({
      teamId: orgId,
      name: input.name.trim(),
      description: input.description ?? "",
      content: input.content,
      role: input.role ?? null,
      tags: input.tags ?? [],
    }).returning()

    await db.insert(blockVersions).values({
      blockId: block.id,
      version: 1,
      content: block.content,
      createdBy: userId,
    })

    createdBlocks.push({ id: block.id, name: block.name })
  }

  await logAudit({
    teamId: orgId,
    userId,
    action: "block.bulk_imported",
    resourceType: "block",
    metadata: { count: createdBlocks.length, names: createdBlocks.map(b => b.name) },
  })

  // Optionally create a composition wiring blocks in order
  let createdComposition = null
  if (compositionInput?.name) {
    const blockMap = new Map(createdBlocks.map(b => [b.name, b.id]))

    const orderedBlockIds = compositionInput.blockOrder
      .map(name => blockMap.get(name))
      .filter((id): id is string => id !== undefined)

    // Build a linear graph: start → block1 → block2 → ... → output
    const graphNodes: any[] = [
      { id: "start-1", type: "start", position: { x: 0, y: 200 }, data: {} },
    ]
    const graphEdges: any[] = []

    let prevId = "start-1"
    orderedBlockIds.forEach((blockId, i) => {
      const nodeId = `block-${i}`
      const blockInfo = createdBlocks.find(b => b.id === blockId)
      graphNodes.push({
        id: nodeId,
        type: "block",
        position: { x: 200 + i * 250, y: 200 },
        data: { blockId, label: blockInfo?.name ?? "Block", tokenCount: 0 },
      })
      graphEdges.push({
        id: `e-${prevId}-${nodeId}`,
        source: prevId,
        target: nodeId,
      })
      prevId = nodeId
    })

    const outputId = "output-1"
    graphNodes.push({
      id: outputId,
      type: "promptOutput",
      position: { x: 200 + orderedBlockIds.length * 250, y: 200 },
      data: {},
    })
    graphEdges.push({
      id: `e-${prevId}-${outputId}`,
      source: prevId,
      target: outputId,
    })

    const [comp] = await db.insert(compositions).values({
      teamId: orgId,
      name: compositionInput.name.trim(),
      description: compositionInput.description ?? "",
      graph: { nodes: graphNodes, edges: graphEdges },
    }).returning()

    createdComposition = { id: comp.id, name: comp.name }

    await logAudit({
      teamId: orgId,
      userId,
      action: "composition.created",
      resourceType: "composition",
      resourceId: comp.id,
      metadata: { name: comp.name, source: "bulk_import" },
    })
  }

  invalidateTeam(orgId)
  configEvents.notify(orgId)

  return NextResponse.json({
    blocks: createdBlocks,
    composition: createdComposition,
  }, { status: 201 })
}
