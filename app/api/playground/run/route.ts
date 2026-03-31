import { db } from "@/lib/db"
import { compositions, blocks, providerKeys } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { assembleGraph } from "@/lib/graph-engine"
import { decrypt } from "@/lib/encryption"
import { getProvider } from "@/lib/providers"

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!

export async function POST(req: Request) {
  const { orgId } = await auth()
  if (!orgId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })

  const { compositionId, context, userMessage, environment } = await req.json()

  // Look up composition
  const [comp] = await db
    .select()
    .from(compositions)
    .where(and(eq(compositions.id, compositionId), eq(compositions.teamId, orgId)))

  if (!comp) return new Response(JSON.stringify({ error: "Composition not found" }), { status: 404 })

  // Get model config
  const metadata = comp.metadata as Record<string, any>
  const modelConfig = metadata?.modelConfig?.[environment ?? "dev"]
  if (!modelConfig?.model) {
    return new Response(
      JSON.stringify({ error: `No model configured for ${environment ?? "dev"} environment. Set one in the Properties panel.` }),
      { status: 400 }
    )
  }

  // Parse provider from model string
  const [providerName, ...modelParts] = modelConfig.model.split("/")
  const modelName = modelParts.join("/")
  if (!providerName || !modelName) {
    return new Response(JSON.stringify({ error: `Invalid model format: ${modelConfig.model}` }), { status: 400 })
  }

  // Fetch provider key
  const [providerKey] = await db
    .select()
    .from(providerKeys)
    .where(and(eq(providerKeys.teamId, orgId), eq(providerKeys.provider, providerName)))

  if (!providerKey) {
    return new Response(
      JSON.stringify({ error: `No API key configured for ${providerName}. Add one in Settings → Providers.` }),
      { status: 400 }
    )
  }

  const apiKey = decrypt(providerKey.encryptedKey, ENCRYPTION_KEY)

  // Get all blocks
  const teamBlocks = await db.select().from(blocks).where(eq(blocks.teamId, orgId))
  const blockLookup: Record<string, { content: string; name: string; role?: string | null; kind?: string; description?: string | null }> = {}
  for (const b of teamBlocks) {
    blockLookup[b.id] = { content: b.content, name: b.name, role: b.role, kind: b.kind, description: b.description }
  }

  // Assemble prompt
  const graph = comp.graph as { nodes: any[]; edges: any[] }
  const assembled = assembleGraph(graph.nodes, graph.edges, blockLookup, context ?? {})

  // Build messages: assembled system messages + user message
  const messages = [
    ...assembled.messages,
    ...(userMessage ? [{ role: "user", content: userMessage }] : []),
  ]

  // Stream from provider
  const provider = getProvider(providerName)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of provider.stream({
          model: modelName,
          messages,
          tools: assembled.tools,
          config: {
            temperature: modelConfig.temperature,
            maxTokens: modelConfig.maxTokens,
            topP: modelConfig.topP,
            stopSequences: modelConfig.stopSequences,
          },
          apiKey,
        })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: err instanceof Error ? err.message : "Unknown error" })}\n\n`)
        )
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
