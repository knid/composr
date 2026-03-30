interface ModelCost {
  input: number
  output: number
}

const MODEL_COSTS: Record<string, ModelCost> = {
  "claude-sonnet-4-6-20250514": { input: 3, output: 15 },
  "claude-sonnet-4-5-20250514": { input: 3, output: 15 },
  "claude-opus-4-6-20250514": { input: 15, output: 75 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
}

export function estimateCost(
  model: string | null,
  inputTokens: number | null,
  outputTokens: number | null
): number {
  if (!model || (!inputTokens && !outputTokens)) return 0
  const costs = MODEL_COSTS[model]
  if (!costs) return 0
  return ((inputTokens ?? 0) * costs.input + (outputTokens ?? 0) * costs.output) / 1_000_000
}

export function formatCost(usd: number): string {
  if (usd === 0) return "$0"
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}
