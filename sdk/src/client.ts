import type { PromptKitConfig, ComposeContext, ComposeResult, TrackPayload, SDKConfig } from "./types"
import { compose } from "./compose"

export class PromptKit {
  private apiKey: string
  private baseUrl: string
  private environment: string
  private syncInterval: number
  private config: SDKConfig | null = null
  private syncTimer: ReturnType<typeof setInterval> | null = null

  constructor(options: PromptKitConfig) {
    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl ?? "https://app.composr.dev"
    this.environment = options.environment ?? "prod"
    this.syncInterval = options.syncIntervalMs ?? 30_000
  }

  async initialize(): Promise<void> {
    await this.fetchConfig()
    this.syncTimer = setInterval(() => this.fetchConfig(), this.syncInterval)
  }

  private async fetchConfig(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/sdk/config/${this.environment}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })
    if (!res.ok) throw new Error(`Composr: config fetch failed (${res.status})`)
    this.config = await res.json()
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
    if (this.syncTimer) clearInterval(this.syncTimer)
  }
}
