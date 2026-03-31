// app/api/blocks/[id]/usage/route.ts
import { db } from "@/lib/db"
import { compositions, deployments } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id: blockId } = await params

  const teamComps = await db
    .select()
    .from(compositions)
    .where(eq(compositions.teamId, orgId))

  const allDeployments = await db
    .select()
    .from(deployments)
    .orderBy(desc(deployments.deployedAt))

  const deployedEnvs = new Map<string, Set<string>>()
  for (const d of allDeployments) {
    if (!deployedEnvs.has(d.compositionId)) {
      deployedEnvs.set(d.compositionId, new Set())
    }
    deployedEnvs.get(d.compositionId)!.add(d.environment)
  }

  const usage: Array<{
    compositionId: string
    compositionName: string
    nodeCount: number
    environments: string[]
  }> = []

  for (const comp of teamComps) {
    const graph = comp.graph as { nodes: any[]; edges: any[] }
    const matchingNodes = (graph.nodes ?? []).filter(
      (n: any) => (n.type === "block" || n.type === "tool") && n.data?.blockId === blockId
    )
    if (matchingNodes.length > 0) {
      usage.push({
        compositionId: comp.id,
        compositionName: comp.name,
        nodeCount: matchingNodes.length,
        environments: Array.from(deployedEnvs.get(comp.id) ?? []),
      })
    }
  }

  return NextResponse.json(usage)
}
