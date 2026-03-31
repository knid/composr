import { selectVariant } from "./hash"
import { evaluateExpression } from "./expression-parser"

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
  skippedBlocks: string[]
  tokenCount: number
  errors: string[]
  variantId: string | null
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
  const errors: string[] = []
  const visited = new Set<string>()
  let variantId: string | null = null

  function walk(nodeId: string) {
    if (visited.has(nodeId)) {
      errors.push(`Cycle detected at node: ${nodeId}`)
      return
    }
    visited.add(nodeId)

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
        } else {
          errors.push(`Block not found: ${blockId}`)
        }
        break
      }

      case "ifBoolean": {
        const field = node.data.field as string
        const resolved = resolveContextValue(context, field)
        if (resolved === undefined) {
          errors.push(`IF node '${node.id}' references undefined context field: '${field}'`)
        }
        const value = Boolean(resolved)
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
        const resolved = resolveContextValue(context, field)
        if (resolved === undefined) {
          errors.push(`IF node '${node.id}' references undefined context field: '${field}'`)
        }
        const value = String(resolved)
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

      case "ifPercentage": {
        const variants = (node.data.variants as Array<{ name: string; weight: number }>) ?? []
        const seed = context._req?.userId ?? context._req?.sessionId ?? String(Date.now())
        const weights = variants.map(v => v.weight)
        const selectedIndex = selectVariant(seed, weights)
        const selectedVariant = variants[selectedIndex]
        if (selectedVariant) {
          variantId = selectedVariant.name
          const matchingEdges = (edgesBySource.get(node.id) ?? []).filter(
            (e) => e.sourceHandle === selectedVariant.name
          )
          for (const edge of matchingEdges) {
            walk(edge.target)
          }
        }
        return
      }

      case "ifExpression": {
        const expression = node.data.expression as string ?? ""
        let value: boolean
        try {
          value = evaluateExpression(expression, context)
        } catch (err) {
          errors.push(`Expression evaluation error in node '${node.id}': ${err instanceof Error ? err.message : String(err)}`)
          value = false
        }
        const handleId = value ? "true" : "false"
        const matchingEdges = (edgesBySource.get(node.id) ?? []).filter(
          (e) => e.sourceHandle === handleId
        )
        for (const edge of matchingEdges) {
          walk(edge.target)
        }
        return
      }

      case "merge":
        break

      case "promptOutput":
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

  // Determine which block nodes were skipped (not on the taken path)
  const allBlockNames = nodes
    .filter((n) => n.type === "block")
    .map((n) => {
      const block = blocks[n.data.blockId as string]
      return block ? block.name : null
    })
    .filter((name): name is string => name !== null)
  const skippedBlocks = allBlockNames.filter((name) => !resolvedBlocks.includes(name))

  const text = result.join("\n\n")
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const tokenCount = Math.round(words.length * 1.3)
  return {
    text,
    blocks: resolvedBlocks,
    skippedBlocks,
    tokenCount,
    errors,
    variantId,
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
