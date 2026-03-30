import { db } from "@/lib/db"
import { compositions, compositionVersions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"
import { configEvents } from "@/lib/config-events"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const [composition] = await db
    .select()
    .from(compositions)
    .where(and(eq(compositions.id, id), eq(compositions.teamId, orgId)))

  if (!composition) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(composition)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId, userId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const { name, description, graph, contextSchema } = body

  const [existing] = await db
    .select()
    .from(compositions)
    .where(and(eq(compositions.id, id), eq(compositions.teamId, orgId)))

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const graphChanged =
    graph !== undefined && JSON.stringify(graph) !== JSON.stringify(existing.graph)
  const newVersion = graphChanged ? existing.version + 1 : existing.version

  const [updated] = await db
    .update(compositions)
    .set({
      name: name ?? existing.name,
      description: description ?? existing.description,
      graph: graph ?? existing.graph,
      contextSchema: contextSchema ?? existing.contextSchema,
      version: newVersion,
      updatedAt: new Date(),
    })
    .where(eq(compositions.id, id))
    .returning()

  if (graphChanged) {
    await db.insert(compositionVersions).values({
      compositionId: id,
      version: newVersion,
      graph: updated.graph,
      contextSchema: updated.contextSchema,
      createdBy: userId,
    })
  }

  await logAudit({ teamId: orgId, userId, action: "composition.updated", resourceType: "composition", resourceId: id, metadata: { name: updated.name, version: updated.version } })

  configEvents.notify(orgId)

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId, userId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  await db
    .delete(compositions)
    .where(and(eq(compositions.id, id), eq(compositions.teamId, orgId)))

  await logAudit({ teamId: orgId, userId, action: "composition.deleted", resourceType: "composition", resourceId: id })

  configEvents.notify(orgId)

  return NextResponse.json({ ok: true })
}
