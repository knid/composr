import { db } from "@/lib/db"
import { pipelines } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.teamId, orgId))
    .orderBy(desc(pipelines.updatedAt))

  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { name, description } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const [pipeline] = await db
    .insert(pipelines)
    .values({
      teamId: orgId,
      name: name.trim(),
      description: description ?? null,
    })
    .returning()

  return NextResponse.json(pipeline, { status: 201 })
}
