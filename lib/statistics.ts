export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export function welchTTest(
  groupA: number[],
  groupB: number[]
): { tStatistic: number; pValue: number; confidenceLevel: number } {
  if (groupA.length < 2 || groupB.length < 2) {
    return { tStatistic: 0, pValue: 1, confidenceLevel: 0 }
  }

  const meanA = mean(groupA)
  const meanB = mean(groupB)
  const stdA = stddev(groupA)
  const stdB = stddev(groupB)
  const nA = groupA.length
  const nB = groupB.length

  const se = Math.sqrt((stdA ** 2) / nA + (stdB ** 2) / nB)
  if (se === 0) return { tStatistic: 0, pValue: 1, confidenceLevel: 0 }

  const tStatistic = (meanA - meanB) / se
  const absT = Math.abs(tStatistic)
  const pValue = Math.min(1, 2 * Math.exp(-0.717 * absT - 0.416 * tStatistic ** 2))
  const confidenceLevel = Math.round((1 - pValue) * 100)

  return { tStatistic, pValue, confidenceLevel }
}

export function experimentStatus(
  confidenceLevel: number,
  threshold = 95
): "too_early" | "trending" | "significant" {
  if (confidenceLevel >= threshold) return "significant"
  if (confidenceLevel >= 70) return "trending"
  return "too_early"
}
