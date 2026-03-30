import { db } from "@/lib/db"
import { blockVersions, blocks } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and, desc } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const [block] = await db
    .select()
    .from(blocks)
    .where(and(eq(blocks.id, id), eq(blocks.teamId, orgId)))

  if (!block) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const versions = await db
    .select()
    .from(blockVersions)
    .where(eq(blockVersions.blockId, id))
    .orderBy(desc(blockVersions.version))

  return NextResponse.json(versions)
}
