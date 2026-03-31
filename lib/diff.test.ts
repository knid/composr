import { describe, it, expect } from "vitest"
import { diffLines } from "./diff"

describe("diffLines", () => {
  it("returns unchanged for identical text", () => {
    const result = diffLines("hello\nworld", "hello\nworld")
    expect(result).toEqual([
      { type: "unchanged", text: "hello" },
      { type: "unchanged", text: "world" },
    ])
  })

  it("detects added lines", () => {
    const result = diffLines("hello", "hello\nworld")
    expect(result).toEqual([
      { type: "unchanged", text: "hello" },
      { type: "added", text: "world" },
    ])
  })

  it("detects removed lines", () => {
    const result = diffLines("hello\nworld", "hello")
    expect(result).toEqual([
      { type: "unchanged", text: "hello" },
      { type: "removed", text: "world" },
    ])
  })

  it("handles complete replacement", () => {
    const result = diffLines("foo\nbar", "baz\nqux")
    expect(result).toEqual([
      { type: "removed", text: "foo" },
      { type: "removed", text: "bar" },
      { type: "added", text: "baz" },
      { type: "added", text: "qux" },
    ])
  })

  it("handles mixed changes", () => {
    const result = diffLines(
      "line1\nline2\nline3\nline4",
      "line1\nchanged\nline3\nnew line\nline4"
    )
    expect(result.filter(d => d.type === "unchanged").map(d => d.text)).toEqual(["line1", "line3", "line4"])
    expect(result.filter(d => d.type === "removed").map(d => d.text)).toEqual(["line2"])
    expect(result.filter(d => d.type === "added").map(d => d.text)).toEqual(["changed", "new line"])
  })

  it("handles empty inputs", () => {
    expect(diffLines("", "hello")).toEqual([{ type: "added", text: "hello" }])
    expect(diffLines("hello", "")).toEqual([{ type: "removed", text: "hello" }])
    expect(diffLines("", "")).toEqual([])
  })
})
