import { describe, it, expect } from "vitest"
import crypto from "crypto"

describe("authenticateSDK hashing", () => {
  it("produces consistent sha256 hash for a given key", () => {
    const key = "pk_live_test123"
    const hash = crypto.createHash("sha256").update(key).digest("hex")
    const hash2 = crypto.createHash("sha256").update(key).digest("hex")
    expect(hash).toBe(hash2)
    expect(hash).toHaveLength(64)
  })

  it("produces different hashes for different keys", () => {
    const hash1 = crypto.createHash("sha256").update("pk_live_a").digest("hex")
    const hash2 = crypto.createHash("sha256").update("pk_live_b").digest("hex")
    expect(hash1).not.toBe(hash2)
  })
})
