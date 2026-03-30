const windows = new Map<string, { count: number; resetAt: number }>()

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export function checkRateLimit(
  key: string,
  limit: number = 100,
  windowMs: number = 60_000
): RateLimitResult {
  const now = Date.now()
  const window = windows.get(key)

  if (!window || now >= window.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (window.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: window.resetAt }
  }

  window.count++
  return { allowed: true, remaining: limit - window.count, resetAt: window.resetAt }
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, window] of windows) {
    if (now >= window.resetAt) windows.delete(key)
  }
}, 5 * 60_000)
