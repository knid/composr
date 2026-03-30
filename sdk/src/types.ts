export interface PromptKitConfig {
  apiKey: string
  environment?: string
  baseUrl?: string
  syncIntervalMs?: number
}

export interface ComposeContext {
  [key: string]: any
  _request?: {
    ip?: string
    userId?: string
    userAgent?: string
  }
}

export interface ComposeResult {
  id: string
  text: string
  version: string
  variantId: string | null
  tokenCount: number
  blocks: string[]
  compositionName: string
}

export interface TrackPayload {
  input: string
  output: string
  model?: string
  latencyMs?: number
}

export interface SDKConfig {
  version: string
  environment: string
  blocks: Record<string, { name: string; content: string; version: number }>
  compositions: Array<{
    id: string
    name: string
    version: number
    graph: { nodes: any[]; edges: any[] }
    contextSchema: any[]
  }>
}
