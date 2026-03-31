import { db } from "@/lib/db"
import { blocks, compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc } from "drizzle-orm"
import { redirect } from "next/navigation"
import { BlockList } from "@/components/blocks/block-list"

export const dynamic = "force-dynamic"

export default async function BlocksPage() {
  const { orgId } = await auth()
  if (!orgId) redirect("/")

  const teamBlocks = await db
    .select()
    .from(blocks)
    .where(eq(blocks.teamId, orgId))
    .orderBy(desc(blocks.updatedAt))

  const teamComps = await db
    .select()
    .from(compositions)
    .where(eq(compositions.teamId, orgId))

  const usageMap: Record<string, string[]> = {}
  for (const comp of teamComps) {
    const graph = comp.graph as { nodes: any[]; edges: any[] }
    for (const node of graph.nodes ?? []) {
      if (node.type === "block" && node.data?.blockId) {
        if (!usageMap[node.data.blockId]) usageMap[node.data.blockId] = []
        if (!usageMap[node.data.blockId].includes(comp.name)) {
          usageMap[node.data.blockId].push(comp.name)
        }
      }
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Blocks</h1>
      <BlockList initialBlocks={JSON.parse(JSON.stringify(teamBlocks))} usageMap={usageMap} />
    </div>
  )
}
