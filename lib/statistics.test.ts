import { describe, it, expect } from "vitest"
import { mean, stddev, welchTTest, experimentStatus } from "./statistics"

describe("mean", () => {
  it("calculates arithmetic mean correctly", () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3)
    expect(mean([10, 20])).toBe(15)
  })

  it("returns 0 for empty array", () => {
    expect(mean([])).toBe(0)
  })
})

describe("stddev", () => {
  it("calculates sample standard deviation correctly", () => {
    // [2,4,4,4,5,5,7,9] has sample stddev ≈ 2.138
    const result = stddev([2, 4, 4, 4, 5, 5, 7, 9])
    expect(result).toBeCloseTo(2.138, 2)
  })

  it("returns 0 for fewer than 2 values", () => {
    expect(stddev([])).toBe(0)
    expect(stddev([5])).toBe(0)
  })
})

describe("welchTTest", () => {
  it("returns high confidence for clearly different groups", () => {
    // 50 values around 8 vs 50 values around 5
    const groupA = Array.from({ length: 50 }, (_, i) => 8 + ((i % 3) - 1) * 0.5)
    const groupB = Array.from({ length: 50 }, (_, i) => 5 + ((i % 3) - 1) * 0.5)
    const { confidenceLevel } = welchTTest(groupA, groupB)
    expect(confidenceLevel).toBeGreaterThan(95)
  })

  it("returns low confidence for similar groups", () => {
    const groupA = [5.0, 5.1, 4.9, 5.0, 5.1]
    const groupB = [5.0, 5.0, 5.1, 4.9, 5.0]
    const { confidenceLevel } = welchTTest(groupA, groupB)
    expect(confidenceLevel).toBeLessThan(70)
  })

  it("returns pValue=1 and confidenceLevel=0 for samples < 2", () => {
    expect(welchTTest([], [])).toEqual({ tStatistic: 0, pValue: 1, confidenceLevel: 0 })
    expect(welchTTest([1], [1, 2, 3])).toEqual({ tStatistic: 0, pValue: 1, confidenceLevel: 0 })
    expect(welchTTest([1, 2, 3], [1])).toEqual({ tStatistic: 0, pValue: 1, confidenceLevel: 0 })
  })
})

describe("experimentStatus", () => {
  it("returns significant when confidence meets threshold", () => {
    expect(experimentStatus(95)).toBe("significant")
    expect(experimentStatus(99)).toBe("significant")
    expect(experimentStatus(80, 80)).toBe("significant")
  })

  it("returns trending when confidence is between 70 and threshold", () => {
    expect(experimentStatus(70)).toBe("trending")
    expect(experimentStatus(85)).toBe("trending")
    expect(experimentStatus(94)).toBe("trending")
  })

  it("returns too_early when confidence is below 70", () => {
    expect(experimentStatus(0)).toBe("too_early")
    expect(experimentStatus(69)).toBe("too_early")
  })

  it("respects custom threshold", () => {
    expect(experimentStatus(85, 90)).toBe("trending")
    expect(experimentStatus(90, 90)).toBe("significant")
  })
})
