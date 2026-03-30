import { configEvents } from "@/lib/config-events"
import { authenticateSDK } from "@/lib/auth-sdk"

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
