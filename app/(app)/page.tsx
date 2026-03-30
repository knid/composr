import { db } from "@/lib/db"
import { blocks, compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { OrganizationSwitcher } from "@clerk/nextjs"
import { eq } from "drizzle-orm"
import { StatCard } from "@/components/dashboard/stat-card"
import Link from "next/link"
import { GitBranch } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const { orgId } = await auth()

  if (!orgId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <h1 className="text-lg font-semibold">Create or select an organization</h1>
        <p className="text-sm text-muted-foreground">Composr uses organizations to scope your data.</p>
        <OrganizationSwitcher afterSelectOrganizationUrl="/" afterCreateOrganizationUrl="/" />
      </div>
    )
  }

  const teamBlocks = await db.select().from(blocks).where(eq(blocks.teamId, orgId))
  const teamComps = await db.select().from(compositions).where(eq(compositions.teamId, orgId))
  const totalTokens = teamBlocks.reduce((sum, b) => sum + Math.round(b.content.length / 4), 0)

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
        <StatCard label="Compositions" value={teamComps.length} />
        <StatCard label="Blocks" value={teamBlocks.length} detail={`~${totalTokens.toLocaleString()} total tokens`} />
        <StatCard label="Assemblies / 24h" value="—" detail="Connect SDK to start tracking" />
        <StatCard label="Avg Score" value="—" detail="Enable scoring in Phase 2" />
      </div>
      <h2 className="text-sm font-semibold text-muted-foreground mb-3">Compositions</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {teamComps.map((comp) => (
          <Link key={comp.id} href={`/compositions/${comp.id}`}
            className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30">
            <div className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">{comp.name}</span>
              <Badge variant="secondary" className="ml-auto text-[10px]">v{comp.version}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
