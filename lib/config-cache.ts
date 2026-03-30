// lib/config-cache.ts

interface CacheEntry {
  data: any
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const DEFAULT_TTL_MS = 10_000 // 10 seconds

/**
 * Get cached value or null if expired/missing.
 */
export function getCached(key: string): any | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data
}

/**
 * Set cached value with TTL.
 */
export function setCached(key: string, data: any, ttlMs: number = DEFAULT_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs })
}

/**
 * Invalidate cache entries for a team (called on mutations).
 */
export function invalidateTeam(teamId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`config:${teamId}:`)) {
      cache.delete(key)
    }
  }
}

// Cleanup expired entries every minute
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of cache) {
    if (now >= entry.expiresAt) cache.delete(key)
  }
}, 60_000)
