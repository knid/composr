import { db } from "@/lib/db"
import { compositions, compositionVersions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"
import { configEvents } from "@/lib/config-events"
import { invalidateTeam } from "@/lib/config-cache"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId, userId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const { version: targetVersion } = body

  if (typeof targetVersion !== "number") {
    return NextResponse.json({ error: "version (number) is required" }, { status: 400 })
  }

  const [comp] = await db
    .select()
    .from(compositions)
    .where(and(eq(compositions.id, id), eq(compositions.teamId, orgId)))

  if (!comp) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [targetVersionRow] = await db
    .select()
    .from(compositionVersions)
    .where(
      and(
        eq(compositionVersions.compositionId, id),
        eq(compositionVersions.version, targetVersion)
      )
    )

  if (!targetVersionRow) {
    return NextResponse.json({ error: `Version ${targetVersion} not found` }, { status: 404 })
  }

  const newVersion = comp.version + 1

  const [updated] = await db
    .update(compositions)
    .set({
      graph: targetVersionRow.graph,
      contextSchema: targetVersionRow.contextSchema,
      version: newVersion,
      updatedAt: new Date(),
    })
    .where(eq(compositions.id, id))
    .returning()

  await db.insert(compositionVersions).values({
    compositionId: id,
    version: newVersion,
    graph: targetVersionRow.graph,
    contextSchema: targetVersionRow.contextSchema,
    createdBy: userId,
  })

  await logAudit({
    teamId: orgId,
    userId,
    action: "composition.rolledBack",
    resourceType: "composition",
    resourceId: id,
    metadata: { fromVersion: comp.version, toVersion: targetVersion, newVersion },
  })

  invalidateTeam(orgId)
  configEvents.notify(orgId)

  return NextResponse.json(updated)
}
