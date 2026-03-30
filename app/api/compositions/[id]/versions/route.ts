import { db } from "@/lib/db"
import { compositionVersions, compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and, desc } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const [comp] = await db
    .select()
    .from(compositions)
    .where(and(eq(compositions.id, id), eq(compositions.teamId, orgId)))

  if (!comp) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const versions = await db
    .select()
    .from(compositionVersions)
    .where(eq(compositionVersions.compositionId, id))
    .orderBy(desc(compositionVersions.version))

  return NextResponse.json(versions)
}
