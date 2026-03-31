import OpenAI from "openai"
import type { Provider, ProviderParams, StreamEvent } from "./types"

export class OpenAIProvider implements Provider {
  async *stream(params: ProviderParams): AsyncIterable<StreamEvent> {
    const client = new OpenAI({ apiKey: params.apiKey })

    const startTime = Date.now()

    const stream = await client.chat.completions.create({
      model: params.model,
      messages: params.messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      })),
      max_tokens: params.config?.maxTokens,
      temperature: params.config?.temperature,
      top_p: params.config?.topP,
      stop: params.config?.stopSequences?.length ? params.config.stopSequences : undefined,
      tools: params.tools?.length ? params.tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })) : undefined,
      stream: true,
      stream_options: { include_usage: true },
    })

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      if (delta?.content) {
        yield { type: "text_delta", content: delta.content }
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.function?.name) {
            yield { type: "tool_use", tool: tc.function.name, toolUseId: tc.id ?? "", input: {} }
          }
        }
      }
      if (chunk.usage) {
        yield {
          type: "done",
          latencyMs: Date.now() - startTime,
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
        }
      }
    }
  }
}
