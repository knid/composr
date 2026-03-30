export function hashToBucket(seed: string, bucketCount: number): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash) % bucketCount
}

export function selectVariant(seed: string, weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0)
  const bucket = hashToBucket(seed, total)
  let cumulative = 0
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i]
    if (bucket < cumulative) return i
  }
  return weights.length - 1
}
