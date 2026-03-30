interface GraphNode {
  id: string
  type: string
  data: Record<string, any>
}

interface GraphEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
}

interface BlockLookup {
  [blockId: string]: { content: string; name: string }
}

interface AssemblyResult {
  text: string
  blocks: string[]
  tokenCount: number
}

export function assembleGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  blocks: BlockLookup,
  context: Record<string, any>
): AssemblyResult {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const edgesBySource = new Map<string, GraphEdge[]>()
  for (const edge of edges) {
    if (!edgesBySource.has(edge.source)) edgesBySource.set(edge.source, [])
    edgesBySource.get(edge.source)!.push(edge)
  }

  const result: string[] = []
  const resolvedBlocks: string[] = []

  function walk(nodeId: string) {
    const node = nodeMap.get(nodeId)
    if (!node) return

    switch (node.type) {
      case "start":
        break

      case "block": {
        const blockId = node.data.blockId as string
        const block = blocks[blockId]
        if (block) {
          let content = block.content
          // Interpolate {{variables}}
          content = content.replace(/\{\{(\w+)\}\}/g, (_, key) => {
            return context[key] !== undefined ? String(context[key]) : `{{${key}}}`
          })
          result.push(content)
          resolvedBlocks.push(block.name)
        }
        break
      }

      case "ifBoolean": {
        const field = node.data.field as string
        const value = Boolean(resolveContextValue(context, field))
        const handleId = value ? "true" : "false"
        const matchingEdges = (edgesBySource.get(node.id) ?? []).filter(
          (e) => e.sourceHandle === handleId
        )
        for (const edge of matchingEdges) {
          walk(edge.target)
        }
        return // Don't follow default edges
      }

      case "ifSwitch": {
        const field = node.data.field as string
        const value = String(resolveContextValue(context, field))
        const cases = (node.data.cases as string[]) ?? []
        const matchCase = cases.includes(value) ? value : cases[cases.length - 1]
        const matchingEdges = (edgesBySource.get(node.id) ?? []).filter(
          (e) => e.sourceHandle === matchCase
        )
        for (const edge of matchingEdges) {
          walk(edge.target)
        }
        return
      }

      case "merge":
        break

      case "output":
        return
    }

    // Follow all outgoing edges (for non-IF nodes)
    const outEdges = edgesBySource.get(node.id) ?? []
    for (const edge of outEdges) {
      walk(edge.target)
    }
  }

  const startNode = nodes.find((n) => n.type === "start")
  if (startNode) walk(startNode.id)

  const text = result.join("\n\n")
  return {
    text,
    blocks: resolvedBlocks,
    tokenCount: Math.round(text.length / 4),
  }
}

function resolveContextValue(context: Record<string, any>, path: string): any {
  const parts = path.split(".")
  let current: any = context
  for (const part of parts) {
    if (current === undefined || current === null) return undefined
    current = current[part]
  }
  return current
}
