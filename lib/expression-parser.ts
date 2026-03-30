/**
 * Safe expression evaluator.
 * Pure manual tokenization and interpretation.
 * Uses NO dynamic code execution of any kind.
 */

/**
 * Split a string on a delimiter, but only at the top level (ignoring splits inside parentheses).
 */
function splitOutsideParens(str: string, delimiter: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ""
  let i = 0

  while (i < str.length) {
    if (str[i] === "(") {
      depth++
      current += str[i]
      i++
    } else if (str[i] === ")") {
      depth--
      current += str[i]
      i++
    } else if (depth === 0 && str.startsWith(delimiter, i)) {
      parts.push(current)
      current = ""
      i += delimiter.length
    } else {
      current += str[i]
      i++
    }
  }
  parts.push(current)
  return parts
}

/**
 * Resolve a value token against context.
 * Handles: string literals ("..." or '...'), number literals, true/false/null, dot-path lookups.
 */
function resolveValue(token: string, context: Record<string, any>): any {
  const t = token.trim()

  // String literal (double or single quotes)
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }

  // Boolean literals
  if (t === "true") return true
  if (t === "false") return false

  // Null
  if (t === "null") return null

  // Number literal
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)

  // Context path (dot notation)
  const parts = t.split(".")
  let current: any = context
  for (const part of parts) {
    if (current === undefined || current === null) return undefined
    current = current[part]
  }
  return current
}

/**
 * Evaluate an atomic comparison expression (no logical operators at top level).
 * Handles: ==, !=, >=, <=, >, <
 * Also handles bare truthy expressions (no operator).
 */
function evaluateComparison(expr: string, context: Record<string, any>): boolean {
  const trimmed = expr.trim()

  // Check for comparison operators (ordered: multi-char before single-char)
  const operators = [">=", "<=", "!=", "==", ">", "<"]
  for (const op of operators) {
    const idx = trimmed.indexOf(op)
    if (idx !== -1) {
      const left = trimmed.slice(0, idx)
      const right = trimmed.slice(idx + op.length)
      const lv = resolveValue(left, context)
      const rv = resolveValue(right, context)

      switch (op) {
        case "==": return lv == rv // intentional loose equality for null/"" cases
        case "!=": return lv != rv
        case ">=": return Number(lv) >= Number(rv)
        case "<=": return Number(lv) <= Number(rv)
        case ">":  return Number(lv) > Number(rv)
        case "<":  return Number(lv) < Number(rv)
      }
    }
  }

  // Bare truthy: just a variable name or path
  return Boolean(resolveValue(trimmed, context))
}

/**
 * Evaluate a unit (handles parentheses and NOT prefix).
 */
function evaluateUnit(expr: string, context: Record<string, any>): boolean {
  const trimmed = expr.trim()

  // NOT prefix
  if (trimmed.startsWith("!")) {
    return !evaluateUnit(trimmed.slice(1), context)
  }

  // Parentheses
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return evaluateExpression(trimmed.slice(1, -1), context)
  }

  return evaluateComparison(trimmed, context)
}

/**
 * Evaluate an expression string with full support for:
 * - Comparison: ==, !=, >, <, >=, <=
 * - Logical AND (&&), OR (||)
 * - NOT (!)
 * - Parentheses
 * - Nested context paths (dot notation)
 * - Bare truthy values
 *
 * SECURITY: Pure manual parsing only. No dynamic code execution.
 */
export function evaluateExpression(expression: string, context: Record<string, any>): boolean {
  const trimmed = expression.trim()
  if (!trimmed) return false

  // Split on || (lowest precedence) — outside parens
  const orParts = splitOutsideParens(trimmed, "||")
  if (orParts.length > 1) {
    return orParts.some((part) => evaluateExpression(part.trim(), context))
  }

  // Split on && — outside parens
  const andParts = splitOutsideParens(trimmed, "&&")
  if (andParts.length > 1) {
    return andParts.every((part) => evaluateExpression(part.trim(), context))
  }

  // Single unit
  return evaluateUnit(trimmed, context)
}
