import { db } from "@/lib/db"
import { pipelines } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, id), eq(pipelines.teamId, orgId)))

  if (!pipeline) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(pipeline)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const { name, description, graph } = body

  const [existing] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, id), eq(pipelines.teamId, orgId)))

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [updated] = await db
    .update(pipelines)
    .set({
      name: name ?? existing.name,
      description: description ?? existing.description,
      graph: graph ?? existing.graph,
      updatedAt: new Date(),
    })
    .where(eq(pipelines.id, id))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  await db
    .delete(pipelines)
    .where(and(eq(pipelines.id, id), eq(pipelines.teamId, orgId)))

  return NextResponse.json({ ok: true })
}
