import { db } from "@/lib/db"
import { apiKeys } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId, userId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const [existing] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.teamId, orgId)))

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.delete(apiKeys).where(eq(apiKeys.id, id))

  await logAudit({ teamId: orgId, userId, action: "api_key.deleted", resourceType: "api_key", resourceId: id, metadata: { name: existing.name } })

  return NextResponse.json({ ok: true })
}
