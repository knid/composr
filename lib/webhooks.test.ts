import { describe, it, expect } from "vitest"
import { matchesEvent, signPayload } from "./webhooks"

describe("matchesEvent", () => {
  it("returns true when event is in the list", () => {
    expect(matchesEvent(["block.created", "block.updated"], "block.created")).toBe(true)
  })

  it("returns false when event is not in the list", () => {
    expect(matchesEvent(["block.created"], "deployment.promoted")).toBe(false)
  })

  it("returns false for empty events list", () => {
    expect(matchesEvent([], "block.created")).toBe(false)
  })
})

describe("signPayload", () => {
  it("produces a consistent HMAC-SHA256 signature", () => {
    const body = '{"event":"test"}'
    const secret = "my-secret"
    const sig1 = signPayload(body, secret)
    const sig2 = signPayload(body, secret)
    expect(sig1).toBe(sig2)
    expect(sig1).toMatch(/^[a-f0-9]{64}$/)
  })

  it("produces different signatures for different secrets", () => {
    const body = '{"event":"test"}'
    expect(signPayload(body, "secret-a")).not.toBe(signPayload(body, "secret-b"))
  })
})
