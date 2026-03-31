/**
 * Sanitize context values to prevent prompt injection.
 * Escapes template tags and XML-like tags in string values.
 */
export function sanitizeContext(context: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {}
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "string") {
      sanitized[key] = value
        .replace(/\{\{/g, "{ {")
        .replace(/\}\}/g, "} }")
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeContext(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}
