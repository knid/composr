import { describe, it, expect } from "vitest"
import { encrypt, decrypt } from "./encryption"

describe("encryption", () => {
  const testKey = "0".repeat(64) // 32 bytes hex

  it("round-trips a string", () => {
    const plaintext = "sk-ant-api03-secret-key-value"
    const encrypted = encrypt(plaintext, testKey)
    expect(encrypted).not.toBe(plaintext)
    expect(encrypted).toContain(":") // iv:ciphertext:tag format
    const decrypted = decrypt(encrypted, testKey)
    expect(decrypted).toBe(plaintext)
  })

  it("produces different ciphertext each time (random IV)", () => {
    const plaintext = "sk-ant-api03-same-key"
    const a = encrypt(plaintext, testKey)
    const b = encrypt(plaintext, testKey)
    expect(a).not.toBe(b)
  })

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("secret", testKey)
    const tampered = encrypted.slice(0, -2) + "ff"
    expect(() => decrypt(tampered, testKey)).toThrow()
  })
})
