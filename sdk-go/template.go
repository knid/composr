package composr

import (
	"fmt"
	"strings"
)

// resolveContextPath resolves a dot-path like "user.tier" against a nested map.
func resolveContextPath(ctx map[string]interface{}, path string) interface{} {
	parts := strings.Split(path, ".")
	var current interface{} = ctx
	for _, part := range parts {
		m, ok := current.(map[string]interface{})
		if !ok {
			return nil
		}
		current, ok = m[part]
		if !ok {
			return nil
		}
	}
	return current
}

// toBool coerces an interface value to bool.
func toBool(v interface{}) bool {
	if v == nil {
		return false
	}
	switch val := v.(type) {
	case bool:
		return val
	case string:
		return val != ""
	case int:
		return val != 0
	case int64:
		return val != 0
	case float64:
		return val != 0
	case []interface{}:
		return len(val) > 0
	default:
		return true
	}
}

// ─── Token types ─────────────────────────────────────────────────────

type tokenType int

const (
	tokenText tokenType = iota
	tokenVar
	tokenIf
	tokenUnless
	tokenEach
)

type token struct {
	typ          tokenType
	value        string   // text content or var path
	defaultValue *string  // for var with default
	condition    string   // for if/unless
	path         string   // for each
	body         []token  // body tokens
	elseBody     []token  // else tokens
}

// ─── Parser ──────────────────────────────────────────────────────────

// parseTemplateTokens parses a template string into tokens.
func parseTemplateTokens(template string) []token {
	var tokens []token
	pos := 0

	for {
		openIdx := strings.Index(template[pos:], "{{")
		if openIdx == -1 {
			// Rest is text
			if pos < len(template) {
				tokens = append(tokens, token{typ: tokenText, value: template[pos:]})
			}
			break
		}
		openIdx += pos

		// Text before tag
		if openIdx > pos {
			tokens = append(tokens, token{typ: tokenText, value: template[pos:openIdx]})
		}

		closeIdx := strings.Index(template[openIdx+2:], "}}")
		if closeIdx == -1 {
			// Unclosed tag — treat rest as text
			tokens = append(tokens, token{typ: tokenText, value: template[openIdx:]})
			break
		}
		closeIdx += openIdx + 2

		inner := strings.TrimSpace(template[openIdx+2 : closeIdx])
		tagEnd := closeIdx + 2

		if strings.HasPrefix(inner, "#if ") {
			condition := strings.TrimSpace(inner[4:])
			body, elseBody, endIdx := parseTemplateBlock(template, tagEnd, "if")
			tokens = append(tokens, token{typ: tokenIf, condition: condition, body: body, elseBody: elseBody})
			pos = endIdx
			continue
		} else if strings.HasPrefix(inner, "#unless ") {
			condition := strings.TrimSpace(inner[8:])
			body, elseBody, endIdx := parseTemplateBlock(template, tagEnd, "unless")
			tokens = append(tokens, token{typ: tokenUnless, condition: condition, body: body, elseBody: elseBody})
			pos = endIdx
			continue
		} else if strings.HasPrefix(inner, "#each ") {
			path := strings.TrimSpace(inner[6:])
			body, _, endIdx := parseTemplateBlock(template, tagEnd, "each")
			tokens = append(tokens, token{typ: tokenEach, path: path, body: body})
			pos = endIdx
			continue
		} else if strings.HasPrefix(inner, "/") || inner == "else" {
			// Consumed by parseTemplateBlock; skip
			pos = tagEnd
			continue
		} else {
			// Variable — check for default
			if pipeIdx := strings.Index(inner, " | default:"); pipeIdx >= 0 {
				varPath := strings.TrimSpace(inner[:pipeIdx])
				defaultStr := strings.TrimSpace(inner[pipeIdx+11:])
				defaultStr = strings.TrimSpace(defaultStr)
				// Strip quotes
				if len(defaultStr) >= 2 &&
					((defaultStr[0] == '"' && defaultStr[len(defaultStr)-1] == '"') ||
						(defaultStr[0] == '\'' && defaultStr[len(defaultStr)-1] == '\'')) {
					defaultStr = defaultStr[1 : len(defaultStr)-1]
				}
				tokens = append(tokens, token{typ: tokenVar, value: varPath, defaultValue: &defaultStr})
			} else {
				tokens = append(tokens, token{typ: tokenVar, value: inner})
			}
		}

		pos = tagEnd
	}

	return tokens
}

// parseTemplateBlock parses the body of a block tag until the matching closing tag.
func parseTemplateBlock(template string, startIdx int, blockType string) (body []token, elseBody []token, endIdx int) {
	depth := 1
	elseIdx := -1
	pos := startIdx
	closingTag := "/" + blockType

	for pos < len(template) {
		openIdx := strings.Index(template[pos:], "{{")
		if openIdx == -1 {
			break
		}
		openIdx += pos

		closeIdx := strings.Index(template[openIdx+2:], "}}")
		if closeIdx == -1 {
			break
		}
		closeIdx += openIdx + 2

		inner := strings.TrimSpace(template[openIdx+2 : closeIdx])
		tagEnd := closeIdx + 2

		if strings.HasPrefix(inner, "#if ") || strings.HasPrefix(inner, "#unless ") || strings.HasPrefix(inner, "#each ") {
			depth++
		} else if inner == closingTag {
			depth--
			if depth == 0 {
				var bodyStr, elseStr string
				if elseIdx >= 0 {
					bodyStr = template[startIdx:elseIdx]
					elseStr = template[elseIdx:openIdx]
				} else {
					bodyStr = template[startIdx:openIdx]
				}
				body = parseTemplateTokens(bodyStr)
				if elseStr != "" {
					elseBody = parseTemplateTokens(elseStr)
				}
				return body, elseBody, tagEnd
			}
		} else if inner == "else" && depth == 1 {
			elseIdx = tagEnd
		}

		pos = tagEnd
	}

	// Unclosed block
	body = parseTemplateTokens(template[startIdx:])
	return body, nil, len(template)
}

// ─── Renderer ────────────────────────────────────────────────────────

func renderTokens(tokens []token, ctx map[string]interface{}) string {
	var sb strings.Builder

	for _, tok := range tokens {
		switch tok.typ {
		case tokenText:
			sb.WriteString(tok.value)

		case tokenVar:
			val := resolveContextPath(ctx, tok.value)
			if val != nil {
				sb.WriteString(fmt.Sprintf("%v", val))
			} else if tok.defaultValue != nil {
				sb.WriteString(*tok.defaultValue)
			} else {
				sb.WriteString("{{")
				sb.WriteString(tok.value)
				sb.WriteString("}}")
			}

		case tokenIf:
			val := resolveContextPath(ctx, tok.condition)
			if toBool(val) {
				sb.WriteString(renderTokens(tok.body, ctx))
			} else {
				sb.WriteString(renderTokens(tok.elseBody, ctx))
			}

		case tokenUnless:
			val := resolveContextPath(ctx, tok.condition)
			if !toBool(val) {
				sb.WriteString(renderTokens(tok.body, ctx))
			} else {
				sb.WriteString(renderTokens(tok.elseBody, ctx))
			}

		case tokenEach:
			items := resolveContextPath(ctx, tok.path)
			if arr, ok := items.([]interface{}); ok {
				for i, item := range arr {
					itemCtx := shallowCopyMap(ctx)
					itemCtx["@index"] = i
					itemCtx["this"] = item
					// Spread object fields
					if m, ok := item.(map[string]interface{}); ok {
						for k, v := range m {
							itemCtx[k] = v
						}
					}
					sb.WriteString(renderTokens(tok.body, itemCtx))
				}
			} else if m, ok := items.(map[string]interface{}); ok {
				i := 0
				for key, val := range m {
					itemCtx := shallowCopyMap(ctx)
					itemCtx["@index"] = i
					itemCtx["@key"] = key
					itemCtx["this"] = val
					sb.WriteString(renderTokens(tok.body, itemCtx))
					i++
				}
			}
		}
	}

	return sb.String()
}

func shallowCopyMap(m map[string]interface{}) map[string]interface{} {
	cp := make(map[string]interface{}, len(m)+4)
	for k, v := range m {
		cp[k] = v
	}
	return cp
}

// renderTemplate renders a template string with the given context.
func renderTemplate(template string, ctx map[string]interface{}) string {
	if !strings.Contains(template, "{{") {
		return template
	}
	tokens := parseTemplateTokens(template)
	return renderTokens(tokens, ctx)
}
