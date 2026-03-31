package composr

import (
	"strconv"
	"strings"
)

// evaluateExpression evaluates a safe expression string against a context map.
// Supports: ==, !=, >, <, >=, <=, && (AND), || (OR), ! (NOT), parentheses,
// nested dot paths, string/number/bool/null literals.
// SECURITY: Pure manual parsing. No dynamic code execution or reflection.
func evaluateExpression(expression string, context map[string]interface{}) bool {
	trimmed := strings.TrimSpace(expression)
	if trimmed == "" {
		return false
	}

	// Split on || (lowest precedence) — outside parens
	orParts := splitOutsideParens(trimmed, "||")
	if len(orParts) > 1 {
		for _, part := range orParts {
			if evaluateExpression(strings.TrimSpace(part), context) {
				return true
			}
		}
		return false
	}

	// Split on && — outside parens
	andParts := splitOutsideParens(trimmed, "&&")
	if len(andParts) > 1 {
		for _, part := range andParts {
			if !evaluateExpression(strings.TrimSpace(part), context) {
				return false
			}
		}
		return true
	}

	// Single unit
	return evaluateUnit(trimmed, context)
}

// splitOutsideParens splits str on delimiter, but only at the top level
// (ignoring splits inside parentheses).
func splitOutsideParens(str, delimiter string) []string {
	var parts []string
	depth := 0
	current := ""
	i := 0

	for i < len(str) {
		if str[i] == '(' {
			depth++
			current += string(str[i])
			i++
		} else if str[i] == ')' {
			depth--
			current += string(str[i])
			i++
		} else if depth == 0 && strings.HasPrefix(str[i:], delimiter) {
			parts = append(parts, current)
			current = ""
			i += len(delimiter)
		} else {
			current += string(str[i])
			i++
		}
	}
	parts = append(parts, current)
	return parts
}

// resolveValue resolves a value token against context.
// Handles: string literals ("..." or '...'), number literals, true/false/null,
// dot-path lookups.
func resolveValue(token string, context map[string]interface{}) interface{} {
	t := strings.TrimSpace(token)

	// String literal (double or single quotes)
	if (strings.HasPrefix(t, `"`) && strings.HasSuffix(t, `"`)) ||
		(strings.HasPrefix(t, "'") && strings.HasSuffix(t, "'")) {
		return t[1 : len(t)-1]
	}

	// Boolean literals
	if t == "true" {
		return true
	}
	if t == "false" {
		return false
	}

	// Null
	if t == "null" {
		return nil
	}

	// Number literal (integer or float)
	if isNumberLiteral(t) {
		n, err := strconv.ParseFloat(t, 64)
		if err == nil {
			return n
		}
	}

	// Context path (dot notation)
	return resolveContextPath(context, t)
}

// isNumberLiteral checks if a string matches -?\d+(\.\d+)?
func isNumberLiteral(s string) bool {
	if len(s) == 0 {
		return false
	}
	i := 0
	if s[0] == '-' {
		i++
		if i >= len(s) {
			return false
		}
	}
	if !isDigit(s[i]) {
		return false
	}
	for i < len(s) && isDigit(s[i]) {
		i++
	}
	if i < len(s) && s[i] == '.' {
		i++
		if i >= len(s) || !isDigit(s[i]) {
			return false
		}
		for i < len(s) && isDigit(s[i]) {
			i++
		}
	}
	return i == len(s)
}

func isDigit(b byte) bool {
	return b >= '0' && b <= '9'
}

// evaluateComparison evaluates an atomic comparison expression (no logical
// operators at the top level). Handles: ==, !=, >=, <=, >, <.
// Also handles bare truthy expressions (no operator).
func evaluateComparison(expr string, context map[string]interface{}) bool {
	trimmed := strings.TrimSpace(expr)

	// Check for comparison operators (ordered: multi-char before single-char)
	operators := []string{">=", "<=", "!=", "==", ">", "<"}
	for _, op := range operators {
		idx := strings.Index(trimmed, op)
		if idx != -1 {
			left := trimmed[:idx]
			right := trimmed[idx+len(op):]
			lv := resolveValue(left, context)
			rv := resolveValue(right, context)

			switch op {
			case "==":
				return looseEqual(lv, rv)
			case "!=":
				return !looseEqual(lv, rv)
			case ">=":
				return toFloat64(lv) >= toFloat64(rv)
			case "<=":
				return toFloat64(lv) <= toFloat64(rv)
			case ">":
				return toFloat64(lv) > toFloat64(rv)
			case "<":
				return toFloat64(lv) < toFloat64(rv)
			}
		}
	}

	// Bare truthy: just a variable name or path
	return toBool(resolveValue(trimmed, context))
}

// evaluateUnit handles parentheses and NOT prefix.
func evaluateUnit(expr string, context map[string]interface{}) bool {
	trimmed := strings.TrimSpace(expr)

	// NOT prefix
	if strings.HasPrefix(trimmed, "!") {
		return !evaluateUnit(trimmed[1:], context)
	}

	// Parentheses
	if strings.HasPrefix(trimmed, "(") && strings.HasSuffix(trimmed, ")") {
		return evaluateExpression(trimmed[1:len(trimmed)-1], context)
	}

	return evaluateComparison(trimmed, context)
}

// looseEqual mimics JavaScript's loose equality (==) for the subset of types
// the expression parser deals with: strings, numbers, booleans, and nil.
func looseEqual(a, b interface{}) bool {
	// nil == nil
	if a == nil && b == nil {
		return true
	}

	// Normalize numeric types so int(10) == float64(10)
	af, aIsNum := toNumber(a)
	bf, bIsNum := toNumber(b)
	if aIsNum && bIsNum {
		return af == bf
	}

	// Fall back to string comparison for mixed types (matches JS loose ==
	// behavior for string/number comparisons like "10" == 10).
	return toString(a) == toString(b)
}

// toNumber tries to extract a float64 from an interface value.
func toNumber(v interface{}) (float64, bool) {
	switch val := v.(type) {
	case float64:
		return val, true
	case float32:
		return float64(val), true
	case int:
		return float64(val), true
	case int32:
		return float64(val), true
	case int64:
		return float64(val), true
	default:
		return 0, false
	}
}

// toFloat64 coerces a value to float64, matching JS Number() coercion.
func toFloat64(v interface{}) float64 {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int32:
		return float64(val)
	case int64:
		return float64(val)
	case bool:
		if val {
			return 1
		}
		return 0
	case string:
		f, err := strconv.ParseFloat(val, 64)
		if err != nil {
			return 0
		}
		return f
	default:
		return 0
	}
}

// toBool is defined in template.go

// toString coerces a value to string for comparison purposes.
func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return val
	case bool:
		if val {
			return "true"
		}
		return "false"
	case float64:
		// Use FormatFloat to avoid trailing zeros for integers
		if val == float64(int64(val)) {
			return strconv.FormatInt(int64(val), 10)
		}
		return strconv.FormatFloat(val, 'f', -1, 64)
	case int:
		return strconv.Itoa(val)
	default:
		return ""
	}
}
