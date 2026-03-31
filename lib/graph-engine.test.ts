import { describe, it, expect } from "vitest"
import { assembleGraph } from "./graph-engine"

const blocks = {
  "b-role": { name: "role", content: "You are a senior engineer." },
  "b-design": { name: "design", content: "Design philosophy for {{projectType}}." },
  "b-auth": { name: "auth-rules", content: "JWT auth with bcrypt." },
  "b-mobile": { name: "mobile-rules", content: "Mobile app patterns." },
  "b-web": { name: "web-rules", content: "Web design patterns." },
  "b-ecom": { name: "ecommerce-rules", content: "Store SDK reference." },
}

// Simple linear graph: Start → role → design → Output
const linearGraph = {
  nodes: [
    { id: "start", type: "start", data: {} },
    { id: "n1", type: "block", data: { blockId: "b-role" } },
    { id: "n2", type: "block", data: { blockId: "b-design" } },
    { id: "output", type: "promptOutput", data: {} },
  ],
  edges: [
    { id: "e1", source: "start", target: "n1" },
    { id: "e2", source: "n1", target: "n2" },
    { id: "e3", source: "n2", target: "output" },
  ],
}

// Graph with IF Boolean: Start → role → IF(hasAuth) → [true: auth] → merge → Output
const booleanGraph = {
  nodes: [
    { id: "start", type: "start", data: {} },
    { id: "n-role", type: "block", data: { blockId: "b-role" } },
    { id: "if-auth", type: "ifBoolean", data: { field: "hasAuth" } },
    { id: "n-auth", type: "block", data: { blockId: "b-auth" } },
    { id: "merge", type: "merge", data: {} },
    { id: "output", type: "promptOutput", data: {} },
  ],
  edges: [
    { id: "e1", source: "start", target: "n-role" },
    { id: "e2", source: "n-role", target: "if-auth" },
    { id: "e3", source: "if-auth", target: "n-auth", sourceHandle: "true" },
    { id: "e4", source: "if-auth", target: "merge", sourceHandle: "false" },
    { id: "e5", source: "n-auth", target: "merge" },
    { id: "e6", source: "merge", target: "output" },
  ],
}

// Graph with IF Switch: Start → IF(projectType) → [mobile/web/ecom] → merge → Output
const switchGraph = {
  nodes: [
    { id: "start", type: "start", data: {} },
    { id: "if-type", type: "ifSwitch", data: { field: "projectType", cases: ["mobile", "web", "ecommerce"] } },
    { id: "n-mobile", type: "block", data: { blockId: "b-mobile" } },
    { id: "n-web", type: "block", data: { blockId: "b-web" } },
    { id: "n-ecom", type: "block", data: { blockId: "b-ecom" } },
    { id: "merge", type: "merge", data: {} },
    { id: "output", type: "promptOutput", data: {} },
  ],
  edges: [
    { id: "e1", source: "start", target: "if-type" },
    { id: "e2", source: "if-type", target: "n-mobile", sourceHandle: "mobile" },
    { id: "e3", source: "if-type", target: "n-web", sourceHandle: "web" },
    { id: "e4", source: "if-type", target: "n-ecom", sourceHandle: "ecommerce" },
    { id: "e5", source: "n-mobile", target: "merge" },
    { id: "e6", source: "n-web", target: "merge" },
    { id: "e7", source: "n-ecom", target: "merge" },
    { id: "e8", source: "merge", target: "output" },
  ],
}

describe("assembleGraph", () => {
  it("assembles linear blocks in order", () => {
    const result = assembleGraph(linearGraph.nodes, linearGraph.edges, blocks, { projectType: "web" })
    expect(result.blocks).toEqual(["role", "design"])
    expect(result.text).toContain("senior engineer")
    expect(result.text).toContain("Design philosophy for web")
  })

  it("interpolates {{variables}} from context", () => {
    const result = assembleGraph(linearGraph.nodes, linearGraph.edges, blocks, { projectType: "mobile" })
    expect(result.text).toContain("Design philosophy for mobile")
  })

  it("keeps unresolved variables as-is", () => {
    const result = assembleGraph(linearGraph.nodes, linearGraph.edges, blocks, {})
    expect(result.text).toContain("{{projectType}}")
  })

  it("includes conditional block when IF Boolean is true", () => {
    const result = assembleGraph(booleanGraph.nodes, booleanGraph.edges, blocks, { hasAuth: true })
    expect(result.blocks).toEqual(["role", "auth-rules"])
    expect(result.text).toContain("JWT auth")
  })

  it("skips conditional block when IF Boolean is false", () => {
    const result = assembleGraph(booleanGraph.nodes, booleanGraph.edges, blocks, { hasAuth: false })
    expect(result.blocks).toEqual(["role"])
    expect(result.text).not.toContain("JWT auth")
  })

  it("routes to correct branch in IF Switch", () => {
    const mobile = assembleGraph(switchGraph.nodes, switchGraph.edges, blocks, { projectType: "mobile" })
    expect(mobile.blocks).toEqual(["mobile-rules"])

    const web = assembleGraph(switchGraph.nodes, switchGraph.edges, blocks, { projectType: "web" })
    expect(web.blocks).toEqual(["web-rules"])

    const ecom = assembleGraph(switchGraph.nodes, switchGraph.edges, blocks, { projectType: "ecommerce" })
    expect(ecom.blocks).toEqual(["ecommerce-rules"])
  })

  it("falls back to last case in IF Switch for unknown values", () => {
    const result = assembleGraph(switchGraph.nodes, switchGraph.edges, blocks, { projectType: "unknown" })
    expect(result.blocks).toEqual(["ecommerce-rules"]) // last case is default
  })

  it("returns token count estimate using word-based method", () => {
    const result = assembleGraph(linearGraph.nodes, linearGraph.edges, blocks, { projectType: "web" })
    expect(result.tokenCount).toBeGreaterThan(0)
    const words = result.text.split(/\s+/).filter((w: string) => w.length > 0)
    expect(result.tokenCount).toBe(Math.round(words.length * 1.3))
  })

  it("handles empty graph", () => {
    const result = assembleGraph(
      [{ id: "start", type: "start", data: {} }],
      [],
      blocks,
      {}
    )
    expect(result.text).toBe("")
    expect(result.blocks).toEqual([])
    expect(result.skippedBlocks).toEqual([])
    expect(result.errors).toEqual([])
  })

  it("percentage node routes same user to same variant deterministically", () => {
    const percentageGraph = {
      nodes: [
        { id: "start", type: "start", data: {} },
        {
          id: "if-pct",
          type: "ifPercentage",
          data: { variants: [{ name: "control", weight: 70 }, { name: "treatment", weight: 30 }] },
        },
        { id: "n-control", type: "block", data: { blockId: "b-role" } },
        { id: "n-treatment", type: "block", data: { blockId: "b-auth" } },
        { id: "output", type: "promptOutput", data: {} },
      ],
      edges: [
        { id: "e1", source: "start", target: "if-pct" },
        { id: "e2", source: "if-pct", target: "n-control", sourceHandle: "control" },
        { id: "e3", source: "if-pct", target: "n-treatment", sourceHandle: "treatment" },
        { id: "e4", source: "n-control", target: "output" },
        { id: "e5", source: "n-treatment", target: "output" },
      ],
    }

    const userId = "user-deterministic-42"
    const context = { _req: { userId } }

    // Run multiple times — same user must always get the same variant
    const firstResult = assembleGraph(percentageGraph.nodes, percentageGraph.edges, blocks, context)
    for (let i = 0; i < 10; i++) {
      const result = assembleGraph(percentageGraph.nodes, percentageGraph.edges, blocks, context)
      expect(result.blocks).toEqual(firstResult.blocks)
    }

    // Exactly one variant should be selected (not both)
    expect(firstResult.blocks).toHaveLength(1)
    expect(["role", "auth-rules"]).toContain(firstResult.blocks[0])

    // variantId should be set to the selected variant name
    expect(firstResult.variantId).toBeTruthy()
    expect(["control", "treatment"]).toContain(firstResult.variantId)
  })

  it("evaluates expression IF node", () => {
    const nodes = [
      { id: "start", type: "start", data: {} },
      { id: "if-expr", type: "ifExpression", data: { expression: '_time.hour >= 18 && projectType == "mobile"' } },
      { id: "n-evening", type: "block", data: { blockId: "b-mobile" } },
      { id: "output", type: "promptOutput", data: {} },
    ]
    const edges = [
      { id: "e1", source: "start", target: "if-expr" },
      { id: "e2", source: "if-expr", target: "n-evening", sourceHandle: "true" },
      { id: "e3", source: "if-expr", target: "output", sourceHandle: "false" },
    ]
    const result = assembleGraph(nodes, edges, blocks, { projectType: "mobile", _time: { hour: 20 } })
    expect(result.blocks).toEqual(["mobile-rules"])

    const result2 = assembleGraph(nodes, edges, blocks, { projectType: "mobile", _time: { hour: 10 } })
    expect(result2.blocks).toEqual([])
  })

  it("returns null variantId when no percentage node is used", () => {
    const result = assembleGraph(linearGraph.nodes, linearGraph.edges, blocks, { projectType: "web" })
    expect(result.variantId).toBeNull()
  })

  it("supports nested context paths", () => {
    const nodes = [
      { id: "start", type: "start", data: {} },
      { id: "if", type: "ifBoolean", data: { field: "_req.authenticated" } },
      { id: "n-auth", type: "block", data: { blockId: "b-auth" } },
      { id: "output", type: "promptOutput", data: {} },
    ]
    const edges = [
      { id: "e1", source: "start", target: "if" },
      { id: "e2", source: "if", target: "n-auth", sourceHandle: "true" },
      { id: "e3", source: "if", target: "output", sourceHandle: "false" },
    ]
    const result = assembleGraph(nodes, edges, blocks, { _req: { authenticated: true } })
    expect(result.blocks).toEqual(["auth-rules"])
  })

  it("returns errors and skippedBlocks fields", () => {
    const result = assembleGraph(linearGraph.nodes, linearGraph.edges, blocks, { projectType: "web" })
    expect(result.errors).toEqual([])
    expect(result.skippedBlocks).toEqual([])
  })

  it("detects cycles and reports error instead of looping forever", () => {
    const nodes = [
      { id: "start", type: "start", data: {} },
      { id: "n1", type: "block", data: { blockId: "b-role" } },
      { id: "n2", type: "block", data: { blockId: "b-design" } },
    ]
    const edges = [
      { id: "e1", source: "start", target: "n1" },
      { id: "e2", source: "n1", target: "n2" },
      { id: "e3", source: "n2", target: "n1" }, // cycle back to n1
    ]
    const result = assembleGraph(nodes, edges, blocks, { projectType: "web" })
    expect(result.errors).toContain("Cycle detected at node: n1")
    // Should still have partial results from before the cycle
    expect(result.blocks).toContain("role")
  })

  it("reports error for missing block", () => {
    const nodes = [
      { id: "start", type: "start", data: {} },
      { id: "n1", type: "block", data: { blockId: "b-nonexistent" } },
      { id: "output", type: "promptOutput", data: {} },
    ]
    const edges = [
      { id: "e1", source: "start", target: "n1" },
      { id: "e2", source: "n1", target: "output" },
    ]
    const result = assembleGraph(nodes, edges, blocks, {})
    expect(result.errors).toContain("Block not found: b-nonexistent")
  })

  it("reports error when IF Boolean references undefined context field", () => {
    const result = assembleGraph(booleanGraph.nodes, booleanGraph.edges, blocks, {})
    expect(result.errors).toContain("IF node 'if-auth' references undefined context field: 'hasAuth'")
  })

  it("tracks skipped blocks when IF condition excludes a branch", () => {
    const result = assembleGraph(booleanGraph.nodes, booleanGraph.edges, blocks, { hasAuth: false })
    expect(result.blocks).toEqual(["role"])
    expect(result.skippedBlocks).toEqual(["auth-rules"])
  })

  it("tracks skipped blocks in switch graph", () => {
    const result = assembleGraph(switchGraph.nodes, switchGraph.edges, blocks, { projectType: "mobile" })
    expect(result.blocks).toEqual(["mobile-rules"])
    expect(result.skippedBlocks).toContain("web-rules")
    expect(result.skippedBlocks).toContain("ecommerce-rules")
  })

  it("returns zero token count for empty text", () => {
    const result = assembleGraph(
      [{ id: "start", type: "start", data: {} }],
      [],
      blocks,
      {}
    )
    expect(result.tokenCount).toBe(0)
  })
})

const toolBlocks = {
  ...blocks,
  "b-weather": { name: "get_weather", content: '{"type":"object","properties":{"location":{"type":"string"}},"required":["location"]}', kind: "tool" as const, description: "Get current weather" },
  "b-search": { name: "search_products", content: '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}', kind: "tool" as const, description: "Search for products" },
}

// Graph with tool nodes: Start → role → tool(weather) → Output
const toolGraph = {
  nodes: [
    { id: "start", type: "start", data: {} },
    { id: "n1", type: "block", data: { blockId: "b-role" } },
    { id: "t1", type: "tool", data: { blockId: "b-weather" } },
    { id: "output", type: "promptOutput", data: {} },
  ],
  edges: [
    { id: "e1", source: "start", target: "n1" },
    { id: "e2", source: "n1", target: "t1" },
    { id: "e3", source: "t1", target: "output" },
  ],
}

describe("tool block assembly", () => {
  it("collects tool blocks into tools[] and excludes from text", () => {
    const result = assembleGraph(toolGraph.nodes, toolGraph.edges, toolBlocks, {})
    expect(result.tools).toHaveLength(1)
    expect(result.tools[0].name).toBe("get_weather")
    expect(result.tools[0].input_schema).toEqual({
      type: "object",
      properties: { location: { type: "string" } },
      required: ["location"],
    })
    expect(result.text).not.toContain("get_weather")
    expect(result.text).toContain("senior engineer")
  })

  it("conditionally includes tools via IF gates", () => {
    const condToolGraph = {
      nodes: [
        { id: "start", type: "start", data: {} },
        { id: "if", type: "ifBoolean", data: { field: "hasWeather" } },
        { id: "t1", type: "tool", data: { blockId: "b-weather" } },
        { id: "output", type: "promptOutput", data: {} },
      ],
      edges: [
        { id: "e1", source: "start", target: "if" },
        { id: "e2", source: "if", target: "t1", sourceHandle: "true" },
        { id: "e3", source: "if", target: "output", sourceHandle: "false" },
        { id: "e4", source: "t1", target: "output" },
      ],
    }

    const withWeather = assembleGraph(condToolGraph.nodes, condToolGraph.edges, toolBlocks, { hasWeather: true })
    expect(withWeather.tools).toHaveLength(1)

    const withoutWeather = assembleGraph(condToolGraph.nodes, condToolGraph.edges, toolBlocks, { hasWeather: false })
    expect(withoutWeather.tools).toHaveLength(0)
  })
})
