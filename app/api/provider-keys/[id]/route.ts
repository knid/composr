import { db } from "@/lib/db"
import { providerKeys } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  await db.delete(providerKeys).where(
    and(eq(providerKeys.id, id), eq(providerKeys.teamId, orgId))
  )

  return NextResponse.json({ ok: true })
}
