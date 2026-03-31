import { db } from "@/lib/db"
import { webhooks } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const teamWebhooks = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.teamId, orgId))

  return NextResponse.json(teamWebhooks)
}

export async function POST(req: Request) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { url, events, secret } = await req.json()

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 })
  }

  const [webhook] = await db.insert(webhooks).values({
    teamId: orgId,
    url,
    events: events ?? [],
    secret: secret || null,
  }).returning()

  return NextResponse.json(webhook, { status: 201 })
}
