import { describe, it, expect } from "vitest"
import { compose } from "./compose"
import type { SDKConfig } from "./types"

const mockConfig: SDKConfig = {
  version: "1",
  environment: "prod",
  blocks: {
    "block-role": { name: "role", content: "You are a senior engineer.", version: 1 },
    "block-design": { name: "design", content: "Design philosophy for {{projectType}}.", version: 1 },
    "block-auth": { name: "auth-rules", content: "JWT auth with bcrypt.", version: 1 },
    "block-mobile": { name: "mobile-rules", content: "Mobile app patterns.", version: 1 },
    "block-web": { name: "web-rules", content: "Web design patterns.", version: 1 },
  },
  compositions: [
    {
      id: "comp-1",
      name: "builder",
      version: 3,
      contextSchema: [],
      graph: {
        nodes: [
          { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
          { id: "n-role", type: "block", position: { x: 100, y: 0 }, data: { blockId: "block-role", label: "role" } },
          { id: "n-design", type: "block", position: { x: 200, y: 0 }, data: { blockId: "block-design", label: "design" } },
          { id: "if-auth", type: "ifBoolean", position: { x: 300, y: 0 }, data: { field: "hasAuth" } },
          { id: "n-auth", type: "block", position: { x: 400, y: 0 }, data: { blockId: "block-auth", label: "auth" } },
          { id: "merge-1", type: "merge", position: { x: 500, y: 0 }, data: {} },
          { id: "output", type: "output", position: { x: 600, y: 0 }, data: {} },
        ],
        edges: [
          { id: "e1", source: "start", target: "n-role" },
          { id: "e2", source: "n-role", target: "n-design" },
          { id: "e3", source: "n-design", target: "if-auth" },
          { id: "e4", source: "if-auth", target: "n-auth", sourceHandle: "true" },
          { id: "e5", source: "if-auth", target: "merge-1", sourceHandle: "false" },
          { id: "e6", source: "n-auth", target: "merge-1" },
          { id: "e7", source: "merge-1", target: "output" },
        ],
      },
    },
  ],
}

describe("SDK compose", () => {
  it("assembles blocks in order", () => {
    const result = compose(mockConfig, "builder", { projectType: "web", hasAuth: false })
    expect(result.blocks).toEqual(["role", "design"])
    expect(result.text).toContain("senior engineer")
    expect(result.text).toContain("Design philosophy for web")
    expect(result.text).not.toContain("JWT")
  })

  it("includes conditional block when condition is true", () => {
    const result = compose(mockConfig, "builder", { projectType: "web", hasAuth: true })
    expect(result.blocks).toEqual(["role", "design", "auth-rules"])
    expect(result.text).toContain("JWT auth")
  })

  it("interpolates variables", () => {
    const result = compose(mockConfig, "builder", { projectType: "mobile", hasAuth: false })
    expect(result.text).toContain("Design philosophy for mobile")
  })

  it("returns metadata", () => {
    const result = compose(mockConfig, "builder", { projectType: "web", hasAuth: false })
    expect(result.id).toMatch(/^asm_/)
    expect(result.version).toBe("v3")
    expect(result.compositionName).toBe("builder")
    expect(result.tokenCount).toBeGreaterThan(0)
  })

  it("throws for unknown composition", () => {
    expect(() => compose(mockConfig, "nonexistent", {})).toThrow('Composition "nonexistent" not found')
  })
})
