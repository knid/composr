import { db } from "@/lib/db"
import { webhooks } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const { url, events, enabled, secret } = body

  const [existing] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.teamId, orgId)))

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [updated] = await db
    .update(webhooks)
    .set({
      url: url ?? existing.url,
      events: events ?? existing.events,
      enabled: enabled !== undefined ? enabled : existing.enabled,
      secret: secret !== undefined ? secret : existing.secret,
    })
    .where(eq(webhooks.id, id))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  await db.delete(webhooks).where(
    and(eq(webhooks.id, id), eq(webhooks.teamId, orgId))
  )

  return NextResponse.json({ ok: true })
}
