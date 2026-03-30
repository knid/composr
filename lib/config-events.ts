// lib/config-events.ts

type ConfigListener = (data: { type: string; timestamp: number }) => void

class ConfigEventBus {
  private listeners = new Map<string, Set<ConfigListener>>()

  /**
   * Subscribe to config changes for a team+environment.
   * Returns an unsubscribe function.
   */
  subscribe(teamId: string, env: string, listener: ConfigListener): () => void {
    const key = `${teamId}:${env}`
    if (!this.listeners.has(key)) this.listeners.set(key, new Set())
    this.listeners.get(key)!.add(listener)
    return () => this.listeners.get(key)?.delete(listener)
  }

  /**
   * Notify all listeners for a team that config has changed.
   * Broadcasts to all environments.
   */
  notify(teamId: string, type: string = "config_updated") {
    const data = { type, timestamp: Date.now() }
    for (const [key, listeners] of this.listeners) {
      if (key.startsWith(teamId + ":")) {
        for (const listener of listeners) {
          try { listener(data) } catch {}
        }
      }
    }
  }
}

export const configEvents = new ConfigEventBus()
