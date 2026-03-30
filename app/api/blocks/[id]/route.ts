import { db } from "@/lib/db"
import { blocks, blockVersions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"
import { configEvents } from "@/lib/config-events"
import { invalidateTeam } from "@/lib/config-cache"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const [block] = await db
    .select()
    .from(blocks)
    .where(and(eq(blocks.id, id), eq(blocks.teamId, orgId)))

  if (!block) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(block)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId, userId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const { name, description, content, tags } = body

  const [existing] = await db
    .select()
    .from(blocks)
    .where(and(eq(blocks.id, id), eq(blocks.teamId, orgId)))

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const newVersion = existing.version + 1

  const [updated] = await db
    .update(blocks)
    .set({
      name: name ?? existing.name,
      description: description ?? existing.description,
      content: content ?? existing.content,
      tags: tags ?? existing.tags,
      version: content !== undefined ? newVersion : existing.version,
      updatedAt: new Date(),
    })
    .where(eq(blocks.id, id))
    .returning()

  if (content !== undefined && content !== existing.content) {
    await db.insert(blockVersions).values({
      blockId: id,
      version: newVersion,
      content,
      createdBy: userId,
    })
  }

  await logAudit({ teamId: orgId, userId, action: "block.updated", resourceType: "block", resourceId: id, metadata: { name: updated.name, version: updated.version } })

  invalidateTeam(orgId)
  configEvents.notify(orgId)

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId, userId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  await db.delete(blocks).where(and(eq(blocks.id, id), eq(blocks.teamId, orgId)))

  await logAudit({ teamId: orgId, userId, action: "block.deleted", resourceType: "block", resourceId: id })

  invalidateTeam(orgId)
  configEvents.notify(orgId)

  return NextResponse.json({ ok: true })
}
