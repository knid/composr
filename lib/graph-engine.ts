import { selectVariant } from "./hash"
import { evaluateExpression } from "./expression-parser"
import { renderTemplate, resolveContextValue } from "./template-engine"

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
  [blockId: string]: { content: string; name: string; role?: string | null }
}

export interface Message {
  role: string
  content: string
}

interface AssemblyResult {
  text: string
  messages: Message[]
  blocks: string[]
  skippedBlocks: string[]
  tokenCount: number
  errors: string[]
  variantId: string | null
}

interface CompositionLookup {
  [compositionId: string]: {
    name: string
    graph: { nodes: GraphNode[]; edges: GraphEdge[] }
  }
}

interface ContextSchemaField {
  name: string
  type?: string
  required?: boolean
  description?: string
}

export function assembleGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  blocks: BlockLookup,
  context: Record<string, any>,
  options?: {
    compositions?: CompositionLookup
    contextSchema?: ContextSchemaField[]
    sanitize?: boolean
    _visitedCompositions?: Set<string>
  }
): AssemblyResult {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const edgesBySource = new Map<string, GraphEdge[]>()
  for (const edge of edges) {
    if (!edgesBySource.has(edge.source)) edgesBySource.set(edge.source, [])
    edgesBySource.get(edge.source)!.push(edge)
  }

  const parts: string[] = []
  const messages: Message[] = []
  const resolvedBlocks: string[] = []
  const errors: string[] = []
  const visited = new Set<string>()
  let variantId: string | null = null

  // Context schema validation
  if (options?.contextSchema) {
    for (const field of options.contextSchema) {
      if (field.required) {
        const value = resolveContextValue(context, field.name)
        if (value === undefined || value === null) {
          errors.push(`Required context field missing: '${field.name}'`)
        }
      }
    }
  }

  // Sanitize context values if requested
  const renderCtx = options?.sanitize ? sanitizeContext(context) : context

  let currentRole: string | null = null
  let currentRoleContent: string[] = []

  function flushRole() {
    if (currentRoleContent.length > 0 && currentRole) {
      messages.push({ role: currentRole, content: currentRoleContent.join("\n\n") })
      currentRoleContent = []
    }
  }

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
          const content = renderTemplate(block.content, renderCtx)
          parts.push(content)
          resolvedBlocks.push(block.name)

          // Multi-message support: track role transitions
          const blockRole = block.role || "system"
          if (currentRole !== null && currentRole !== blockRole) {
            flushRole()
          }
          currentRole = blockRole
          currentRoleContent.push(content)
        } else {
          errors.push(`Block not found: ${blockId}`)
        }
        break
      }

      case "compositionRef": {
        const compositionId = node.data.compositionId as string
        const compositions = options?.compositions
        if (!compositions || !compositions[compositionId]) {
          errors.push(`Composition not found for ref: ${compositionId}`)
          break
        }

        // Cycle detection across compositions
        const visitedComps = options?._visitedCompositions ?? new Set<string>()
        if (visitedComps.has(compositionId)) {
          errors.push(`Circular composition reference detected: ${compositionId}`)
          break
        }

        const comp = compositions[compositionId]
        const childVisited = new Set(visitedComps)
        childVisited.add(compositionId)

        const childResult = assembleGraph(
          comp.graph.nodes,
          comp.graph.edges,
          blocks,
          renderCtx,
          {
            compositions,
            sanitize: options?.sanitize,
            _visitedCompositions: childVisited,
          }
        )

        if (childResult.text) {
          parts.push(childResult.text)
          // Merge child messages into current
          for (const msg of childResult.messages) {
            if (currentRole !== null && currentRole !== msg.role) {
              flushRole()
            }
            currentRole = msg.role
            currentRoleContent.push(msg.content)
          }
        }
        resolvedBlocks.push(...childResult.blocks)
        errors.push(...childResult.errors)
        if (childResult.variantId) variantId = childResult.variantId
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

  // Flush any remaining role content
  flushRole()

  // Determine which block nodes were skipped (not on the taken path)
  const allBlockNames = nodes
    .filter((n) => n.type === "block")
    .map((n) => {
      const block = blocks[n.data.blockId as string]
      return block ? block.name : null
    })
    .filter((name): name is string => name !== null)
  const skippedBlocks = allBlockNames.filter((name) => !resolvedBlocks.includes(name))

  const text = parts.join("\n\n")
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const tokenCount = Math.round(words.length * 1.3)
  return {
    text,
    messages,
    blocks: resolvedBlocks,
    skippedBlocks,
    tokenCount,
    errors,
    variantId,
  }
}

/**
 * Deep-clone context and escape values that could be used for prompt injection.
 */
function sanitizeContext(context: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {}
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "string") {
      sanitized[key] = value
        .replace(/\{\{/g, "{ {")
        .replace(/\}\}/g, "} }")
        .replace(/<\/?[a-zA-Z_][\w-]*[^>]*>/g, (tag) => tag.replace(/</g, "&lt;").replace(/>/g, "&gt;"))
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeContext(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}
