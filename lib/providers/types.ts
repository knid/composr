export interface StreamEvent {
  type: "text_delta" | "tool_use" | "done" | "error"
  content?: string
  tool?: string
  input?: Record<string, any>
  toolUseId?: string
  cost?: number
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  error?: string
}

export interface ProviderParams {
  model: string
  messages: Array<{ role: string; content: string }>
  tools?: Array<{ name: string; description: string; input_schema: Record<string, any> }>
  config?: { temperature?: number; maxTokens?: number; topP?: number; stopSequences?: string[] }
  apiKey: string
}

export interface Provider {
  stream(params: ProviderParams): AsyncIterable<StreamEvent>
}
