import { configEvents } from "@/lib/config-events"
import { authenticateSDK } from "@/lib/auth-sdk"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ env: string }> }
) {
  // EventSource doesn't support Authorization headers — also accept token as query param
  const url = new URL(req.url)
  const queryToken = url.searchParams.get("token")
  let apiKey
  if (queryToken) {
    const crypto = await import("crypto")
    const { db } = await import("@/lib/db")
    const { apiKeys } = await import("@/lib/schema")
    const { eq } = await import("drizzle-orm")
    const hash = crypto.createHash("sha256").update(queryToken).digest("hex")
    const [found] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash))
    apiKey = found ?? null
  } else {
    apiKey = await authenticateSDK(req)
  }
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
