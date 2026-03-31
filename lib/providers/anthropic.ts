import Anthropic from "@anthropic-ai/sdk"
import type { Provider, ProviderParams, StreamEvent } from "./types"

export class AnthropicProvider implements Provider {
  async *stream(params: ProviderParams): AsyncIterable<StreamEvent> {
    const client = new Anthropic({ apiKey: params.apiKey })

    const systemMessages = params.messages.filter((m) => m.role === "system")
    const nonSystemMessages = params.messages.filter((m) => m.role !== "system")

    // Ensure there's at least one non-system message
    const userMessages = nonSystemMessages.length > 0
      ? nonSystemMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      : [{ role: "user" as const, content: "Hello" }]

    const startTime = Date.now()

    const stream = client.messages.stream({
      model: params.model,
      system: systemMessages.map((m) => ({ type: "text" as const, text: m.content })),
      messages: userMessages,
      max_tokens: params.config?.maxTokens ?? 1024,
      temperature: params.config?.temperature,
      top_p: params.config?.topP,
      stop_sequences: params.config?.stopSequences,
      tools: params.tools?.length ? params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
      })) : undefined,
    })

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          yield { type: "text_delta", content: event.delta.text }
        }
      } else if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          yield { type: "tool_use", tool: event.content_block.name, toolUseId: event.content_block.id, input: {} }
        }
      } else if (event.type === "message_stop") {
        const finalMessage = await stream.finalMessage()
        yield {
          type: "done",
          latencyMs: Date.now() - startTime,
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
        }
      }
    }
  }
}
