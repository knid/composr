import type { SDKConfig, ComposeContext, ComposeResult } from "./types"
import { selectVariant } from "./hash"
import { evaluateExpression } from "./expression-parser"
import { SDK_VERSION } from "./version"

export function compose(
  config: SDKConfig,
  compositionName: string,
  context: ComposeContext
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

  const parts: string[] = []
  const resolvedBlocks: string[] = []
  let variantId: string | null = null

  function resolve(ctx: Record<string, any>, path: string): any {
    return path.split(".").reduce((o: any, k: string) => o?.[k], ctx)
  }

  function walk(nodeId: string) {
    const node = nodeMap.get(nodeId)
    if (!node) return

    if (node.type === "block") {
      const block = config.blocks[node.data.blockId]
      if (block) {
        let content = block.content
        content = content.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) =>
          fullContext[key] !== undefined ? String(fullContext[key]) : `{{${key}}}`
        )
        parts.push(content)
        resolvedBlocks.push(block.name)
      }
    } else if (node.type === "ifBoolean") {
      const value = Boolean(resolve(fullContext, node.data.field))
      const handle = value ? "true" : "false"
      for (const e of (edgesBySource.get(node.id) ?? []).filter((e: any) => e.sourceHandle === handle)) {
        walk(e.target)
      }
      return
    } else if (node.type === "ifSwitch") {
      const value = String(resolve(fullContext, node.data.field))
      const cases = node.data.cases ?? []
      const match = cases.includes(value) ? value : cases[cases.length - 1]
      for (const e of (edgesBySource.get(node.id) ?? []).filter((e: any) => e.sourceHandle === match)) {
        walk(e.target)
      }
      return
    } else if (node.type === "ifPercentage") {
      const variants = (node.data.variants as Array<{ name: string; weight: number }>) ?? []
      const seed = fullContext._req?.userId ?? fullContext._req?.sessionId ?? String(Date.now())
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
      const value = evaluateExpression(expression, fullContext)
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

  const text = parts.join("\n\n")
  return {
    id: `asm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    version: `v${comp.version}`,
    variantId,
    tokenCount: Math.round(text.length / 4),
    blocks: resolvedBlocks,
    compositionName,
  }
}
