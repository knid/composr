import type { Provider } from "./types"
import { AnthropicProvider } from "./anthropic"
import { OpenAIProvider } from "./openai"

const providers: Record<string, () => Provider> = {
  anthropic: () => new AnthropicProvider(),
  openai: () => new OpenAIProvider(),
}

export function getProvider(name: string): Provider {
  const factory = providers[name]
  if (!factory) throw new Error(`Unknown provider: ${name}`)
  return factory()
}

export type { Provider, StreamEvent, ProviderParams } from "./types"
