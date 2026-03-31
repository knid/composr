import { describe, it, expect } from "vitest"
import { renderTemplate, resolveContextValue } from "./template-engine"

describe("resolveContextValue", () => {
  it("resolves top-level key", () => {
    expect(resolveContextValue({ name: "Alice" }, "name")).toBe("Alice")
  })

  it("resolves dot-path", () => {
    expect(resolveContextValue({ user: { tier: "gold" } }, "user.tier")).toBe("gold")
  })

  it("returns undefined for missing path", () => {
    expect(resolveContextValue({}, "missing.path")).toBeUndefined()
  })

  it("returns undefined when intermediate is null", () => {
    expect(resolveContextValue({ user: null }, "user.tier")).toBeUndefined()
  })
})

describe("renderTemplate", () => {
  describe("simple variables", () => {
    it("replaces simple variable", () => {
      expect(renderTemplate("Hello {{name}}", { name: "World" })).toBe("Hello World")
    })

    it("replaces dot-path variable", () => {
      expect(renderTemplate("Tier: {{user.tier}}", { user: { tier: "gold" } })).toBe("Tier: gold")
    })

    it("leaves unresolved variable as-is", () => {
      expect(renderTemplate("Hello {{missing}}", {})).toBe("Hello {{missing}}")
    })

    it("renders numbers", () => {
      expect(renderTemplate("Count: {{count}}", { count: 42 })).toBe("Count: 42")
    })

    it("renders boolean", () => {
      expect(renderTemplate("Active: {{active}}", { active: true })).toBe("Active: true")
    })
  })

  describe("default values", () => {
    it("uses default when variable is missing", () => {
      expect(renderTemplate('{{role | default: "assistant"}}', {})).toBe("assistant")
    })

    it("uses value when present, ignoring default", () => {
      expect(renderTemplate('{{role | default: "assistant"}}', { role: "admin" })).toBe("admin")
    })

    it("supports single-quoted defaults", () => {
      expect(renderTemplate("{{role | default: 'user'}}", {})).toBe("user")
    })

    it("supports unquoted defaults", () => {
      expect(renderTemplate("{{role | default: 20}}", {})).toBe("20")
    })

    it("supports dot-path with default", () => {
      expect(renderTemplate('{{user.role | default: "guest"}}', {})).toBe("guest")
    })
  })

  describe("#if blocks", () => {
    it("renders body when truthy", () => {
      expect(renderTemplate("{{#if isAdmin}}Admin access{{/if}}", { isAdmin: true })).toBe("Admin access")
    })

    it("skips body when falsy", () => {
      expect(renderTemplate("{{#if isAdmin}}Admin access{{/if}}", { isAdmin: false })).toBe("")
    })

    it("renders else when falsy", () => {
      expect(
        renderTemplate("{{#if isAdmin}}Admin{{else}}User{{/if}}", { isAdmin: false })
      ).toBe("User")
    })

    it("evaluates dot-path condition", () => {
      expect(
        renderTemplate("{{#if user.isAdmin}}Admin{{/if}}", { user: { isAdmin: true } })
      ).toBe("Admin")
    })

    it("treats empty array as falsy", () => {
      expect(renderTemplate("{{#if items}}Has items{{/if}}", { items: [] })).toBe("")
    })

    it("treats non-empty array as truthy", () => {
      expect(renderTemplate("{{#if items}}Has items{{/if}}", { items: [1] })).toBe("Has items")
    })

    it("treats undefined as falsy", () => {
      expect(renderTemplate("{{#if missing}}Yes{{else}}No{{/if}}", {})).toBe("No")
    })
  })

  describe("#unless blocks", () => {
    it("renders when falsy", () => {
      expect(renderTemplate("{{#unless isAdmin}}Restricted{{/unless}}", { isAdmin: false })).toBe("Restricted")
    })

    it("skips when truthy", () => {
      expect(renderTemplate("{{#unless isAdmin}}Restricted{{/unless}}", { isAdmin: true })).toBe("")
    })

    it("supports else", () => {
      expect(
        renderTemplate("{{#unless isAdmin}}Restricted{{else}}Welcome{{/unless}}", { isAdmin: true })
      ).toBe("Welcome")
    })
  })

  describe("#each blocks", () => {
    it("iterates over array of strings", () => {
      expect(
        renderTemplate("{{#each items}}{{this}}\n{{/each}}", { items: ["A", "B", "C"] })
      ).toBe("A\nB\nC\n")
    })

    it("iterates over array of objects", () => {
      const items = [{ name: "Camera" }, { name: "GPS" }]
      expect(
        renderTemplate("{{#each methods}}{{name}}, {{/each}}", { methods: items })
      ).toBe("Camera, GPS, ")
    })

    it("provides @index", () => {
      expect(
        renderTemplate("{{#each items}}{{@index}}: {{this}}\n{{/each}}", { items: ["A", "B"] })
      ).toBe("0: A\n1: B\n")
    })

    it("provides this.field for objects", () => {
      const items = [{ n: "X" }, { n: "Y" }]
      expect(
        renderTemplate("{{#each items}}{{this.n}}{{/each}}", { items })
      ).toBe("XY")
    })

    it("iterates over object keys", () => {
      expect(
        renderTemplate("{{#each settings}}{{@key}}={{this}};{{/each}}", { settings: { a: 1, b: 2 } })
      ).toBe("a=1;b=2;")
    })

    it("skips non-iterable value", () => {
      expect(renderTemplate("{{#each items}}{{this}}{{/each}}", { items: "not-array" })).toBe("")
    })

    it("skips undefined value", () => {
      expect(renderTemplate("{{#each items}}{{this}}{{/each}}", {})).toBe("")
    })
  })

  describe("nested blocks", () => {
    it("handles #if inside #each", () => {
      const ctx = {
        methods: [
          { name: "camera", enabled: true },
          { name: "gps", enabled: false },
          { name: "storage", enabled: true },
        ],
      }
      expect(
        renderTemplate("{{#each methods}}{{#if enabled}}{{name}} {{/if}}{{/each}}", ctx)
      ).toBe("camera storage ")
    })

    it("handles #each inside #if", () => {
      const ctx = { isMobile: true, methods: ["camera", "gps"] }
      expect(
        renderTemplate("{{#if isMobile}}Methods: {{#each methods}}{{this}} {{/each}}{{/if}}", ctx)
      ).toBe("Methods: camera gps ")
    })

    it("handles nested #if", () => {
      const ctx = { a: true, b: true }
      expect(
        renderTemplate("{{#if a}}A{{#if b}}B{{/if}}{{/if}}", ctx)
      ).toBe("AB")
    })
  })

  describe("fast path", () => {
    it("returns template as-is when no tags", () => {
      expect(renderTemplate("Hello World", {})).toBe("Hello World")
    })

    it("returns empty string for empty input", () => {
      expect(renderTemplate("", {})).toBe("")
    })
  })

  describe("edge cases", () => {
    it("handles multiple variables in one line", () => {
      expect(
        renderTemplate("{{first}} and {{last}}", { first: "A", last: "B" })
      ).toBe("A and B")
    })

    it("handles variable next to text", () => {
      expect(renderTemplate("pre{{x}}post", { x: "-" })).toBe("pre-post")
    })

    it("preserves whitespace", () => {
      expect(renderTemplate("  {{x}}  ", { x: "hi" })).toBe("  hi  ")
    })
  })
})
