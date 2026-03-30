import { db } from "@/lib/db"
import { blocks } from "@/lib/schema"
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

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Blocks</h1>
      <BlockList initialBlocks={JSON.parse(JSON.stringify(teamBlocks))} />
    </div>
  )
}
