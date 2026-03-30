import { db } from "@/lib/db"
import { compositions, compositionVersions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc } from "drizzle-orm"
import { NextResponse } from "next/server"

const DEFAULT_GRAPH = {
  nodes: [
    { id: "start", type: "start", position: { x: 50, y: 200 }, data: {} },
    { id: "output", type: "output", position: { x: 600, y: 200 }, data: {} },
  ],
  edges: [{ id: "start-output", source: "start", target: "output" }],
}

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const teamCompositions = await db
    .select()
    .from(compositions)
    .where(eq(compositions.teamId, orgId))
    .orderBy(desc(compositions.updatedAt))

  return NextResponse.json(teamCompositions)
}

export async function POST(req: Request) {
  const { orgId, userId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { name, description, graph, contextSchema } = body

  const [composition] = await db
    .insert(compositions)
    .values({
      teamId: orgId,
      name,
      description: description ?? "",
      graph: graph ?? DEFAULT_GRAPH,
      contextSchema: contextSchema ?? [],
    })
    .returning()

  await db.insert(compositionVersions).values({
    compositionId: composition.id,
    version: 1,
    graph: composition.graph,
    contextSchema: composition.contextSchema,
    createdBy: userId,
  })

  return NextResponse.json(composition, { status: 201 })
}
