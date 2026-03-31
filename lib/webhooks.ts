import { createHmac } from "crypto"
import { db } from "@/lib/db"
import { webhooks } from "@/lib/schema"
import { eq } from "drizzle-orm"

export function matchesEvent(events: string[], event: string): boolean {
  return events.includes(event)
}

export function signPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex")
}

interface WebhookPayload {
  event: string
  timestamp: string
  teamId: string
  resource: {
    type: string
    id?: string
    metadata?: Record<string, any>
  }
}

export async function fireWebhooks(
  teamId: string,
  event: string,
  resource: { type: string; id?: string; metadata?: Record<string, any> }
) {
  try {
    const teamWebhooks = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.teamId, teamId))

    const matching = teamWebhooks.filter(
      (w) => w.enabled && matchesEvent(w.events as string[], event)
    )

    if (matching.length === 0) return

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      teamId,
      resource,
    }

    const body = JSON.stringify(payload)

    for (const webhook of matching) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (webhook.secret) {
        headers["X-Composr-Signature"] = signPayload(body, webhook.secret)
      }

      fetch(webhook.url, {
        method: "POST",
        headers,
        body,
      }).catch((err) => {
        console.error(`Webhook delivery failed for ${webhook.url}:`, err)
      })
    }
  } catch (err) {
    console.error("Webhook fire failed:", err)
  }
}
