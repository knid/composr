import { db } from "@/lib/db"
import { apiKeys } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { configEvents } from "@/lib/config-events"
import crypto from "crypto"

async function authenticateSDK(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null
  const key = authHeader.slice(7)
  const hash = crypto.createHash("sha256").update(key).digest("hex")
  const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash))
  return apiKey ?? null
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ env: string }> }
) {
  const apiKey = await authenticateSDK(req)
  if (!apiKey) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { env } = await params
  const teamId = apiKey.teamId

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // Send initial heartbeat
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`))

      // Subscribe to config changes
      const unsubscribe = configEvents.subscribe(teamId, env, (data) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          unsubscribe()
        }
      })

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "heartbeat", timestamp: Date.now() })}\n\n`))
        } catch {
          clearInterval(heartbeat)
          unsubscribe()
        }
      }, 30_000)

      // Cleanup on close
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat)
        unsubscribe()
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
