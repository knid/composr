import { describe, it, expect } from "vitest"
import {
  runStructuredOutputEval,
  runCodeEval,
  runCompositeEval,
} from "./eval-runner"

describe("runStructuredOutputEval", () => {
  it("returns score 100 for valid JSON object", () => {
    const result = runStructuredOutputEval('{"key": "value"}')
    expect(result.score).toBe(100)
    expect(result.reasoning).toBe("Valid JSON output")
    expect(result.scorerName).toBe("structured_output")
  })

  it("returns score 0 for invalid JSON", () => {
    const result = runStructuredOutputEval("not json at all")
    expect(result.score).toBe(0)
    expect(result.reasoning).toBeTruthy()
    expect(result.scorerName).toBe("structured_output")
  })

  it("returns score 100 for JSON array", () => {
    const result = runStructuredOutputEval('[1, 2, 3]')
    expect(result.score).toBe(100)
    expect(result.reasoning).toBe("Valid JSON output")
  })
})

describe("runCodeEval", () => {
  it("evaluates length-based scoring", () => {
    const result = runCodeEval(
      "outputLength > 0 ? 100 : 0",
      "hello",
      "world"
    )
    expect(result.score).toBe(100)
    expect(result.scorerName).toBe("code")
  })

  it("evaluates numeric expressions", () => {
    const result = runCodeEval("50 + 25", "", "")
    expect(result.score).toBe(75)
  })

  it("clamps results above 100", () => {
    const result = runCodeEval("200 + 50", "", "")
    expect(result.score).toBe(100)
  })

  it("clamps results below 0", () => {
    const result = runCodeEval("0 - 50", "", "")
    expect(result.score).toBe(0)
  })

  it("rejects unsafe expressions", () => {
    const result = runCodeEval("process.exit(1)", "hello", "world")
    expect(result.score).toBe(0)
    expect(result.error).toBe("Expression contains unsafe characters")
  })

  it("rejects expressions with function calls", () => {
    const result = runCodeEval("fetch('http://evil.com')", "", "")
    expect(result.score).toBe(0)
    expect(result.error).toBe("Expression contains unsafe characters")
  })
})

describe("runCompositeEval", () => {
  it("computes weighted average", () => {
    const config = {
      scorers: [
        { name: "quality", weight: 2 },
        { name: "relevance", weight: 1 },
      ],
    }
    const autoScores = {
      quality: { score: 90 },
      relevance: { score: 60 },
    }
    const result = runCompositeEval(config, autoScores)
    // (90*2 + 60*1) / (2+1) = 240/3 = 80
    expect(result.score).toBe(80)
    expect(result.scorerName).toBe("composite")
  })

  it("skips missing scorers", () => {
    const config = {
      scorers: [
        { name: "quality", weight: 2 },
        { name: "missing_scorer", weight: 1 },
      ],
    }
    const autoScores = {
      quality: { score: 90 },
    }
    const result = runCompositeEval(config, autoScores)
    // Only quality matches: 90*2 / 2 = 90
    expect(result.score).toBe(90)
  })

  it("returns 0 when all scorers are missing", () => {
    const config = {
      scorers: [
        { name: "missing1", weight: 1 },
        { name: "missing2", weight: 1 },
      ],
    }
    const result = runCompositeEval(config, {})
    expect(result.score).toBe(0)
    expect(result.reasoning).toBe("No matching scorers found")
  })
})
