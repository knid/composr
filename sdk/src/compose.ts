import type { SDKConfig, ComposeContext, ComposeResult, Message, ToolDefinition, ModelConfig } from "./types"
import { selectVariant } from "./hash"
import { evaluateExpression } from "./expression-parser"
import { renderTemplate } from "./template-engine"
import { SDK_VERSION } from "./version"

export function compose(
  config: SDKConfig,
  compositionName: string,
  context: ComposeContext,
  options?: { sanitize?: boolean; _visitedCompositions?: Set<string> }
): ComposeResult {
  const comp = config.compositions.find((c) => c.name === compositionName)
  if (!comp) throw new Error(`Composition "${compositionName}" not found`)

  const { nodes, edges } = comp.graph
  const nodeMap = new Map(nodes.map((n: any) => [n.id, n]))
  const edgesBySource = new Map<string, any[]>()
  for (const edge of edges) {
    if (!edgesBySource.has(edge.source)) edgesBySource.set(edge.source, [])
    edgesBySource.get(edge.source)!.push(edge)
  }

  const fullContext: Record<string, any> = {
    ...context,
    _time: {
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      date: new Date().toISOString().split("T")[0],
      timestamp: new Date().toISOString(),
    },
    _env: { name: config.environment },
    _sdk: { version: SDK_VERSION, language: "typescript" },
  }
  if (context._request) {
    fullContext._req = context._request
  }

  const renderCtx = options?.sanitize ? sanitizeContext(fullContext) : fullContext

  // Validate context schema
  const schemaErrors: string[] = []
  if (comp.contextSchema) {
    for (const field of comp.contextSchema) {
      if (field.required) {
        const parts = field.name.split(".")
        let val: any = renderCtx
        for (const p of parts) {
          val = val?.[p]
        }
        if (val === undefined || val === null) {
          schemaErrors.push(`Required context field missing: '${field.name}'`)
        }
      }
    }
  }

  const parts: string[] = []
  const tools: ToolDefinition[] = []
  const messages: Message[] = []
  const resolvedBlocks: string[] = []
  let variantId: string | null = null

  let currentRole: string | null = null
  let currentRoleContent: string[] = []

  function flushRole() {
    if (currentRoleContent.length > 0 && currentRole) {
      messages.push({ role: currentRole, content: currentRoleContent.join("\n\n") })
      currentRoleContent = []
    }
  }

  function walk(nodeId: string) {
    const node = nodeMap.get(nodeId)
    if (!node) return

    if (node.type === "block") {
      const block = config.blocks[node.data.blockId]
      if (block) {
        const content = renderTemplate(block.content, renderCtx)
        parts.push(content)
        resolvedBlocks.push(block.name)

        const blockRole = block.role || "system"
        if (currentRole !== null && currentRole !== blockRole) {
          flushRole()
        }
        currentRole = blockRole
        currentRoleContent.push(content)
      }
    } else if (node.type === "tool") {
      const block = config.blocks[node.data.blockId]
      if (block) {
        try {
          const inputSchema = JSON.parse(block.content)
          tools.push({ name: block.name, description: block.description ?? "", input_schema: inputSchema })
        } catch {}
        resolvedBlocks.push(block.name)
      }
      // Falls through to edge-following at bottom
    } else if (node.type === "compositionRef") {
      const compositionId = node.data.compositionId as string
      const refComp = config.compositions.find((c) => c.id === compositionId)
      if (!refComp) return

      const visitedComps = options?._visitedCompositions ?? new Set<string>()
      if (visitedComps.has(compositionId)) return // circular ref

      const childVisited = new Set(visitedComps)
      childVisited.add(compositionId)

      const childResult = compose(config, refComp.name, context, {
        sanitize: options?.sanitize,
        _visitedCompositions: childVisited,
      })

      if (childResult.text) {
        parts.push(childResult.text)
        for (const msg of childResult.messages) {
          if (currentRole !== null && currentRole !== msg.role) {
            flushRole()
          }
          currentRole = msg.role
          currentRoleContent.push(msg.content)
        }
      }
      resolvedBlocks.push(...childResult.blocks)
      if (childResult.variantId) variantId = childResult.variantId
      return
    } else if (node.type === "ifBoolean") {
      const value = Boolean(resolve(renderCtx, node.data.field))
      const handle = value ? "true" : "false"
      for (const e of (edgesBySource.get(node.id) ?? []).filter((e: any) => e.sourceHandle === handle)) {
        walk(e.target)
      }
      return
    } else if (node.type === "ifSwitch") {
      const value = String(resolve(renderCtx, node.data.field))
      const cases = node.data.cases ?? []
      const match = cases.includes(value) ? value : cases[cases.length - 1]
      for (const e of (edgesBySource.get(node.id) ?? []).filter((e: any) => e.sourceHandle === match)) {
        walk(e.target)
      }
      return
    } else if (node.type === "ifPercentage") {
      const variants = (node.data.variants as Array<{ name: string; weight: number }>) ?? []
      const seed = renderCtx._req?.userId ?? renderCtx._req?.sessionId ?? String(Date.now())
      const weights = variants.map((v: { name: string; weight: number }) => v.weight)
      const selectedIndex = selectVariant(seed, weights)
      const selectedVariant = variants[selectedIndex]
      if (selectedVariant) {
        variantId = selectedVariant.name
        for (const e of (edgesBySource.get(node.id) ?? []).filter((e: any) => e.sourceHandle === selectedVariant.name)) {
          walk(e.target)
        }
      }
      return
    } else if (node.type === "ifExpression") {
      const expression = (node.data.expression as string) ?? ""
      const value = evaluateExpression(expression, renderCtx)
      const handle = value ? "true" : "false"
      for (const e of (edgesBySource.get(node.id) ?? []).filter((e: any) => e.sourceHandle === handle)) {
        walk(e.target)
      }
      return
    }

    for (const e of edgesBySource.get(node.id) ?? []) {
      walk(e.target)
    }
  }

  const start = nodes.find((n: any) => n.type === "start")
  if (start) walk(start.id)

  // Flush remaining
  flushRole()

  const text = parts.join("\n\n")

  const modelConfig = comp.metadata?.modelConfig?.[config.environment] ?? null
  const model: string | null = modelConfig?.model ?? null
  let configResult: ModelConfig | null = null
  if (model && modelConfig) {
    configResult = {} as ModelConfig
    if (modelConfig.temperature !== undefined) configResult.temperature = modelConfig.temperature
    if (modelConfig.maxTokens !== undefined) configResult.maxTokens = modelConfig.maxTokens
    if (modelConfig.topP !== undefined) configResult.topP = modelConfig.topP
    if (modelConfig.stopSequences !== undefined) configResult.stopSequences = modelConfig.stopSequences
  }

  return {
    id: `asm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    messages,
    model,
    config: configResult,
    tools,
    version: `v${comp.version}`,
    variantId,
    tokenCount: Math.round(text.length / 4),
    blocks: resolvedBlocks,
    compositionName,
    errors: schemaErrors,
  }
}

function resolve(ctx: Record<string, any>, path: string): any {
  return path.split(".").reduce((o: any, k: string) => o?.[k], ctx)
}

function sanitizeContext(context: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {}
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "string") {
      sanitized[key] = value
        .replace(/\{\{/g, "{ {")
        .replace(/\}\}/g, "} }")
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeContext(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}
