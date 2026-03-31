export interface ComposrConfig {
  apiKey: string
  environment?: string
  baseUrl?: string
  syncIntervalMs?: number
  useSSE?: boolean
}

export interface ComposeContext {
  [key: string]: any
  _request?: {
    ip?: string
    userId?: string
    userAgent?: string
    sessionId?: string
  }
}

export interface Message {
  role: string
  content: string
}

export interface ModelConfig {
  temperature?: number
  maxTokens?: number
  topP?: number
  stopSequences?: string[]
}

export interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, any>
}

export interface ComposeResult {
  id: string
  text: string
  messages: Message[]
  model: string | null
  config: ModelConfig | null
  tools: ToolDefinition[]
  version: string
  variantId: string | null
  tokenCount: number
  blocks: string[]
  compositionName: string
  errors: string[]
}

export interface TrackPayload {
  input: string
  output: string
  model?: string
  latencyMs?: number
  compositionId?: string
  compositionVersion?: number
  environment?: string
  variantId?: string | null
  context?: Record<string, any>
  resolvedBlocks?: string[]
  tokenCount?: number
}

export interface ContextSchemaField {
  name: string
  type?: string
  required?: boolean
  description?: string
}

export interface SDKConfig {
  version: string
  environment: string
  blocks: Record<string, { name: string; content: string; version: number; role?: string | null; kind?: string; description?: string }>
  compositions: Array<{
    id: string
    name: string
    version: number
    graph: { nodes: any[]; edges: any[] }
    contextSchema: ContextSchemaField[]
    metadata?: Record<string, any>
  }>
}
