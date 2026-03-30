import { db } from "@/lib/db"
import { compositions, deployments } from "@/lib/schema"
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
  const { environment } = body

  if (!["dev", "staging", "prod"].includes(environment)) {
    return NextResponse.json({ error: "Invalid environment" }, { status: 400 })
  }

  const [composition] = await db
    .select()
    .from(compositions)
    .where(and(eq(compositions.id, id), eq(compositions.teamId, orgId)))

  if (!composition) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [deployment] = await db
    .insert(deployments)
    .values({
      compositionId: id,
      environment,
      version: composition.version,
      deployedBy: userId,
    })
    .returning()

  await logAudit({ teamId: orgId, userId, action: "deployment.promoted", resourceType: "deployment", resourceId: deployment.id, metadata: { environment, version: composition.version } })

  invalidateTeam(orgId)
  configEvents.notify(orgId)

  return NextResponse.json(deployment, { status: 201 })
}
