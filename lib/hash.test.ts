import { describe, it, expect } from "vitest"
import { hashToBucket, selectVariant } from "./hash"

describe("hashToBucket", () => {
  it("returns deterministic results for the same input", () => {
    const result1 = hashToBucket("user-abc-123", 10)
    const result2 = hashToBucket("user-abc-123", 10)
    const result3 = hashToBucket("user-abc-123", 10)
    expect(result1).toBe(result2)
    expect(result2).toBe(result3)
  })

  it("returns different results for different inputs", () => {
    const results = new Set<number>()
    for (let i = 0; i < 20; i++) {
      results.add(hashToBucket(`user-${i}`, 10))
    }
    // With 20 different seeds and 10 buckets, we should see multiple distinct values
    expect(results.size).toBeGreaterThan(1)
  })

  it("distributes across buckets (100 users across 10 buckets uses >5 buckets)", () => {
    const buckets = new Set<number>()
    for (let i = 0; i < 100; i++) {
      buckets.add(hashToBucket(`user-${i}`, 10))
    }
    expect(buckets.size).toBeGreaterThan(5)
  })

  it("always returns a value in [0, bucketCount)", () => {
    for (let i = 0; i < 50; i++) {
      const result = hashToBucket(`seed-${i}`, 10)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThan(10)
    }
  })

  it("handles empty string seed", () => {
    const result = hashToBucket("", 5)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThan(5)
  })
})

describe("selectVariant", () => {
  it("returns deterministic results for the same input", () => {
    const weights = [70, 30]
    const result1 = selectVariant("user-xyz", weights)
    const result2 = selectVariant("user-xyz", weights)
    expect(result1).toBe(result2)
  })

  it("always returns a valid variant index", () => {
    const weights = [50, 30, 20]
    for (let i = 0; i < 100; i++) {
      const idx = selectVariant(`user-${i}`, weights)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(weights.length)
    }
  })

  it("respects weight distribution approximately (70/30 split on 1000 users)", () => {
    const weights = [70, 30]
    let countA = 0
    let countB = 0
    for (let i = 0; i < 1000; i++) {
      const idx = selectVariant(`user-${i}`, weights)
      if (idx === 0) countA++
      else countB++
    }
    // Allow generous tolerance: expect roughly 60-80% in variant A
    expect(countA).toBeGreaterThan(550)
    expect(countA).toBeLessThan(850)
    expect(countB).toBeGreaterThan(150)
    expect(countB).toBeLessThan(450)
  })

  it("handles single variant — always returns index 0", () => {
    for (let i = 0; i < 20; i++) {
      const idx = selectVariant(`user-${i}`, [100])
      expect(idx).toBe(0)
    }
  })

  it("handles equal weights", () => {
    const weights = [50, 50]
    const counts = [0, 0]
    for (let i = 0; i < 200; i++) {
      counts[selectVariant(`seed-${i}`, weights)]++
    }
    // Both variants should get some traffic
    expect(counts[0]).toBeGreaterThan(50)
    expect(counts[1]).toBeGreaterThan(50)
  })
})
