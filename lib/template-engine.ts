/**
 * Handlebars-subset template engine for prompt block content.
 *
 * Supports:
 *   {{variable}}              — simple interpolation
 *   {{dot.path.var}}          — nested dot-path resolution
 *   {{var | default: "x"}}    — default value fallback
 *   {{#if cond}}...{{/if}}    — conditional block
 *   {{#if cond}}...{{else}}...{{/if}}
 *   {{#unless cond}}...{{/unless}}
 *   {{#each items}}...{{/each}} — iteration ({{this}}, {{this.field}}, {{@index}}, {{@key}})
 *
 * SECURITY: Pure string parsing — no eval, no dynamic code execution.
 */

// ─── Context resolution ─────────────────────────────────────────────

export function resolveContextValue(context: Record<string, any>, path: string): any {
  const parts = path.split(".")
  let current: any = context
  for (const part of parts) {
    if (current === undefined || current === null) return undefined
    current = current[part]
  }
  return current
}

function isTruthy(value: any): boolean {
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value)
}

// ─── Token types ─────────────────────────────────────────────────────

interface TextToken {
  type: "text"
  value: string
}

interface VarToken {
  type: "var"
  path: string
  defaultValue?: string
}

interface IfToken {
  type: "if" | "unless"
  condition: string
  body: Token[]
  elseBody: Token[]
}

interface EachToken {
  type: "each"
  path: string
  body: Token[]
}

type Token = TextToken | VarToken | IfToken | EachToken

// ─── Parser ──────────────────────────────────────────────────────────

const TAG_RE = /\{\{([^}]+)\}\}/g

function parseTokens(template: string): Token[] {
  const tokens: Token[] = []
  let pos = 0

  TAG_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TAG_RE.exec(template)) !== null) {
    // Text before this tag
    if (match.index > pos) {
      tokens.push({ type: "text", value: template.slice(pos, match.index) })
    }

    const inner = match[1].trim()

    if (inner.startsWith("#if ")) {
      const condition = inner.slice(4).trim()
      const { body, elseBody, endIndex } = parseBlock(template, TAG_RE.lastIndex, "if")
      tokens.push({ type: "if", condition, body, elseBody })
      TAG_RE.lastIndex = endIndex
    } else if (inner.startsWith("#unless ")) {
      const condition = inner.slice(8).trim()
      const { body, elseBody, endIndex } = parseBlock(template, TAG_RE.lastIndex, "unless")
      tokens.push({ type: "unless", condition, body, elseBody })
      TAG_RE.lastIndex = endIndex
    } else if (inner.startsWith("#each ")) {
      const path = inner.slice(6).trim()
      const { body, endIndex } = parseBlock(template, TAG_RE.lastIndex, "each")
      tokens.push({ type: "each", path, body })
      TAG_RE.lastIndex = endIndex
    } else if (inner.startsWith("/")) {
      // Closing tag — should be consumed by parseBlock; if we see it here, ignore
    } else if (inner === "else") {
      // Should be consumed by parseBlock; if we see it here, ignore
    } else {
      // Variable: may have default
      const defaultMatch = inner.match(/^([\w.@]+)\s*\|\s*default:\s*(.+)$/)
      if (defaultMatch) {
        let defaultVal = defaultMatch[2].trim()
        // Strip quotes
        if (
          (defaultVal.startsWith('"') && defaultVal.endsWith('"')) ||
          (defaultVal.startsWith("'") && defaultVal.endsWith("'"))
        ) {
          defaultVal = defaultVal.slice(1, -1)
        }
        tokens.push({ type: "var", path: defaultMatch[1], defaultValue: defaultVal })
      } else {
        tokens.push({ type: "var", path: inner })
      }
    }

    pos = TAG_RE.lastIndex
  }

  // Trailing text
  if (pos < template.length) {
    tokens.push({ type: "text", value: template.slice(pos) })
  }

  return tokens
}

/**
 * Parse the body of a block tag (#if, #unless, #each) until we hit the
 * matching closing tag. Returns body tokens, optional elseBody, and the
 * character index right after the closing tag.
 */
function parseBlock(
  template: string,
  startIndex: number,
  blockType: "if" | "unless" | "each"
): { body: Token[]; elseBody: Token[]; endIndex: number } {
  let depth = 1
  let elseIndex = -1

  const blockRe = /\{\{([^}]+)\}\}/g
  blockRe.lastIndex = startIndex

  let match: RegExpExecArray | null
  while ((match = blockRe.exec(template)) !== null) {
    const inner = match[1].trim()

    if (inner.startsWith("#if ") || inner.startsWith("#unless ") || inner.startsWith("#each ")) {
      depth++
    } else if (inner === `/${blockType}`) {
      depth--
      if (depth === 0) {
        const endIndex = blockRe.lastIndex
        const bodyStr = template.slice(startIndex, elseIndex >= 0 ? elseIndex : match.index)
        const elseStr = elseIndex >= 0 ? template.slice(elseIndex, match.index) : ""
        return {
          body: parseTokens(bodyStr),
          elseBody: elseStr ? parseTokens(elseStr) : [],
          endIndex,
        }
      }
    } else if (inner === "else" && depth === 1) {
      elseIndex = blockRe.lastIndex
    }
  }

  // Unclosed block — treat rest as body
  const bodyStr = template.slice(startIndex)
  return { body: parseTokens(bodyStr), elseBody: [], endIndex: template.length }
}

// ─── Renderer ────────────────────────────────────────────────────────

function renderTokens(tokens: Token[], context: Record<string, any>): string {
  let result = ""

  for (const token of tokens) {
    switch (token.type) {
      case "text":
        result += token.value
        break

      case "var": {
        const value = resolveContextValue(context, token.path)
        if (value !== undefined && value !== null) {
          result += String(value)
        } else if (token.defaultValue !== undefined) {
          result += token.defaultValue
        } else {
          // Leave unresolved variable as-is for debugging
          result += `{{${token.path}}}`
        }
        break
      }

      case "if": {
        const value = resolveContextValue(context, token.condition)
        if (isTruthy(value)) {
          result += renderTokens(token.body, context)
        } else {
          result += renderTokens(token.elseBody, context)
        }
        break
      }

      case "unless": {
        const value = resolveContextValue(context, token.condition)
        if (!isTruthy(value)) {
          result += renderTokens(token.body, context)
        } else {
          result += renderTokens(token.elseBody, context)
        }
        break
      }

      case "each": {
        const items = resolveContextValue(context, token.path)
        if (Array.isArray(items)) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            const itemCtx: Record<string, any> = {
              ...context,
              "@index": i,
              this: item,
            }
            // If item is an object, spread its fields into context for {{field}} access
            if (item && typeof item === "object" && !Array.isArray(item)) {
              Object.assign(itemCtx, item)
            }
            result += renderTokens(token.body, itemCtx)
          }
        } else if (items && typeof items === "object") {
          // Iterate over object keys
          const keys = Object.keys(items)
          for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            const itemCtx: Record<string, any> = {
              ...context,
              "@index": i,
              "@key": key,
              this: items[key],
            }
            result += renderTokens(token.body, itemCtx)
          }
        }
        break
      }
    }
  }

  return result
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Render a template string with the given context.
 */
export function renderTemplate(template: string, context: Record<string, any>): string {
  // Fast path: no tags at all
  if (!template.includes("{{")) return template
  const tokens = parseTokens(template)
  return renderTokens(tokens, context)
}
