package composr

import "strings"

// sanitizeContext escapes template tags in string values to prevent prompt injection.
func sanitizeContext(ctx map[string]interface{}) map[string]interface{} {
	sanitized := make(map[string]interface{}, len(ctx))
	for k, v := range ctx {
		switch val := v.(type) {
		case string:
			s := strings.ReplaceAll(val, "{{", "{ {")
			s = strings.ReplaceAll(s, "}}", "} }")
			sanitized[k] = s
		case map[string]interface{}:
			sanitized[k] = sanitizeContext(val)
		default:
			sanitized[k] = v
		}
	}
	return sanitized
}
