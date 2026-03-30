import { describe, it, expect } from "vitest"
import { evaluateExpression } from "./expression-parser"

const ctx = {
  projectType: "mobile",
  hasAuth: true,
  maxFiles: 25,
  _time: { hour: 20 },
  _req: { country: "TR", userId: "user-123" },
}

describe("evaluateExpression", () => {
  it("string comparison — true case", () => {
    expect(evaluateExpression('projectType == "mobile"', ctx)).toBe(true)
  })

  it("string comparison — false case", () => {
    expect(evaluateExpression('projectType == "web"', ctx)).toBe(false)
  })

  it("boolean field comparison — true", () => {
    expect(evaluateExpression("hasAuth == true", ctx)).toBe(true)
  })

  it("boolean field comparison — false", () => {
    expect(evaluateExpression("hasAuth == false", ctx)).toBe(false)
  })

  it("number comparison — > true", () => {
    expect(evaluateExpression("maxFiles > 20", ctx)).toBe(true)
  })

  it("number comparison — <= false", () => {
    expect(evaluateExpression("maxFiles <= 20", ctx)).toBe(false)
  })

  it("number comparison — <= true", () => {
    expect(evaluateExpression("maxFiles <= 25", ctx)).toBe(true)
  })

  it("nested path — _time.hour >= 18 (true)", () => {
    expect(evaluateExpression("_time.hour >= 18", ctx)).toBe(true)
  })

  it("nested path — _time.hour <= 6 (false)", () => {
    expect(evaluateExpression("_time.hour <= 6", ctx)).toBe(false)
  })

  it("nested path — _req.country string comparison", () => {
    expect(evaluateExpression('_req.country == "TR"', ctx)).toBe(true)
  })

  it("logical AND — both true", () => {
    expect(evaluateExpression('hasAuth == true && projectType == "mobile"', ctx)).toBe(true)
  })

  it("logical AND — one false", () => {
    expect(evaluateExpression('hasAuth == true && projectType == "web"', ctx)).toBe(false)
  })

  it("logical OR — one true", () => {
    expect(evaluateExpression('projectType == "web" || projectType == "mobile"', ctx)).toBe(true)
  })

  it("logical OR — both false", () => {
    expect(evaluateExpression('projectType == "web" || projectType == "ios"', ctx)).toBe(false)
  })

  it("logical NOT — negates false field", () => {
    expect(evaluateExpression("!hasAuth", { ...ctx, hasAuth: false })).toBe(true)
  })

  it("logical NOT — negates truthy field", () => {
    expect(evaluateExpression("!hasAuth", ctx)).toBe(false)
  })

  it("bare truthy — existing true field", () => {
    expect(evaluateExpression("hasAuth", ctx)).toBe(true)
  })

  it("bare truthy — nonexistent field returns false", () => {
    expect(evaluateExpression("nonExistentField", ctx)).toBe(false)
  })

  it("empty expression returns false", () => {
    expect(evaluateExpression("", ctx)).toBe(false)
  })

  it("complex expression with parentheses", () => {
    expect(
      evaluateExpression('(_time.hour >= 18 || _time.hour <= 6) && projectType == "mobile"', ctx)
    ).toBe(true)
  })

  it("parentheses with false branch", () => {
    expect(
      evaluateExpression('(_time.hour >= 18 || _time.hour <= 6) && projectType == "web"', ctx)
    ).toBe(false)
  })
})
