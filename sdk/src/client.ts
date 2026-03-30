import type { ComposrConfig, ComposeContext, ComposeResult, TrackPayload, SDKConfig } from "./types"
import { compose } from "./compose"

export class Composr {
  private apiKey: string
  private baseUrl: string
  private environment: string
  private syncInterval: number
  private useSSE: boolean
  private config: SDKConfig | null = null
  private syncTimer: ReturnType<typeof setInterval> | null = null
  private eventSource: EventSource | null = null

  constructor(options: ComposrConfig) {
    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl ?? "https://app.composr.dev"
    this.environment = options.environment ?? "prod"
    this.syncInterval = options.syncIntervalMs ?? 30_000
    this.useSSE = options.useSSE ?? (typeof EventSource !== "undefined")
  }

  async initialize(): Promise<void> {
    await this.fetchConfig()

    if (this.useSSE && typeof EventSource !== "undefined") {
      this.connectSSE()
    } else {
      this.startPolling()
    }
  }

  private async fetchConfig(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/sdk/config/${this.environment}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })
    if (!res.ok) throw new Error(`Composr: config fetch failed (${res.status})`)
    this.config = await res.json()
  }

  private connectSSE(): void {
    try {
      const url = `${this.baseUrl}/api/sdk/stream/${this.environment}?token=${encodeURIComponent(this.apiKey)}`
      this.eventSource = new EventSource(url)

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === "config_updated") {
            this.fetchConfig().catch(() => {})
          }
        } catch {}
      }

      this.eventSource.onerror = () => {
        this.eventSource?.close()
        this.eventSource = null
        this.startPolling()
      }
    } catch {
      this.startPolling()
    }
  }

  private startPolling(): void {
    if (!this.syncTimer) {
      this.syncTimer = setInterval(() => this.fetchConfig().catch(() => {}), this.syncInterval)
    }
  }

  async compose(name: string, context: ComposeContext = {}): Promise<ComposeResult> {
    if (!this.config) await this.initialize()
    return compose(this.config!, name, context)
  }

  async track(assemblyId: string, payload: TrackPayload): Promise<void> {
    await fetch(`${this.baseUrl}/api/sdk/track`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ assemblyId, ...payload }),
    })
  }

  async score(assemblyId: string, metrics: Record<string, any>): Promise<void> {
    await fetch(`${this.baseUrl}/api/sdk/score`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ assemblyId, metrics }),
    })
  }

  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
  }
}
