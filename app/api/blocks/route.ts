import { db } from "@/lib/db"
import { blocks, blockVersions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc } from "drizzle-orm"
import { NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"
import { configEvents } from "@/lib/config-events"
import { invalidateTeam } from "@/lib/config-cache"

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const teamBlocks = await db
    .select()
    .from(blocks)
    .where(eq(blocks.teamId, orgId))
    .orderBy(desc(blocks.updatedAt))

  return NextResponse.json(teamBlocks)
}

export async function POST(req: Request) {
  const { orgId, userId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { name, description, content, tags, role, kind } = body

  const [block] = await db.insert(blocks).values({
    teamId: orgId,
    name,
    description: description ?? "",
    content: content ?? "",
    role: kind === "tool" ? null : (role ?? null),
    kind: kind ?? "prompt",
    tags: tags ?? [],
  }).returning()

  await db.insert(blockVersions).values({
    blockId: block.id,
    version: 1,
    content: block.content,
    createdBy: userId,
  })

  await logAudit({ teamId: orgId, userId, action: "block.created", resourceType: "block", resourceId: block.id, metadata: { name: block.name } })

  invalidateTeam(orgId)
  configEvents.notify(orgId)

  return NextResponse.json(block, { status: 201 })
}
