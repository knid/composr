import { describe, it, expect, vi, beforeEach } from "vitest"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

import { Composr } from "./client"

describe("Composr client", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("track()", () => {
    it("forwards resolvedBlocks and tokenCount in track payload", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })

      const client = new Composr({ apiKey: "pk_test_123", baseUrl: "http://localhost:3000" })

      await client.track("asm_123", {
        input: "hello",
        output: "world",
        model: "claude-sonnet-4-6-20250514",
        resolvedBlocks: ["role", "design"],
        tokenCount: 500,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/sdk/track",
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
        })
      )

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.assemblyId).toBe("asm_123")
      expect(body.resolvedBlocks).toEqual(["role", "design"])
      expect(body.tokenCount).toBe(500)
    })
  })

  describe("score()", () => {
    it("sends metrics to score endpoint", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })

      const client = new Composr({ apiKey: "pk_test_123", baseUrl: "http://localhost:3000" })

      await client.score("asm_123", { buildSuccess: true, errorCount: 0 })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.assemblyId).toBe("asm_123")
      expect(body.metrics).toEqual({ buildSuccess: true, errorCount: 0 })
    })
  })

  describe("SSE configuration", () => {
    it("defaults useSSE to false when EventSource is not available", () => {
      const client = new Composr({ apiKey: "pk_test_123" })
      expect(client).toBeDefined()
    })

    it("respects explicit useSSE: false", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          version: "1",
          environment: "dev",
          blocks: {},
          compositions: [],
        }),
      })

      const client = new Composr({
        apiKey: "pk_test_123",
        baseUrl: "http://localhost:3000",
        useSSE: false,
      })

      await client.initialize()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/sdk/config/prod",
        expect.any(Object)
      )

      client.destroy()
    })
  })
})
