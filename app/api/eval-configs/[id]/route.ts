import { db } from "@/lib/db"
import { evalConfigs, compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  // Look up the config and verify org ownership via composition
  const [existing] = await db
    .select({ config: evalConfigs, teamId: compositions.teamId })
    .from(evalConfigs)
    .innerJoin(compositions, eq(evalConfigs.compositionId, compositions.id))
    .where(eq(evalConfigs.id, id))

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (existing.teamId !== orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const body = await req.json()
  const { scorerName, enabled, sampleRate, judgeModel, judgePrompt, weight } = body

  const [updated] = await db
    .update(evalConfigs)
    .set({
      ...(scorerName !== undefined ? { scorerName } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
      ...(sampleRate !== undefined ? { sampleRate } : {}),
      ...(judgeModel !== undefined ? { judgeModel } : {}),
      ...(judgePrompt !== undefined ? { judgePrompt } : {}),
      ...(weight !== undefined ? { weight } : {}),
      updatedAt: new Date(),
    })
    .where(eq(evalConfigs.id, id))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  // Look up the config and verify org ownership via composition
  const [existing] = await db
    .select({ config: evalConfigs, teamId: compositions.teamId })
    .from(evalConfigs)
    .innerJoin(compositions, eq(evalConfigs.compositionId, compositions.id))
    .where(eq(evalConfigs.id, id))

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (existing.teamId !== orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  await db.delete(evalConfigs).where(eq(evalConfigs.id, id))

  return NextResponse.json({ ok: true })
}
