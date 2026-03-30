import { db } from "@/lib/db"
import { blocks, compositions, assemblyLogs, scores, auditLogs } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { OrganizationSwitcher } from "@clerk/nextjs"
import { eq, gte, and, isNotNull, desc } from "drizzle-orm"
import { ensureTeam } from "@/lib/ensure-team"
import { StatCard } from "@/components/dashboard/stat-card"
import Link from "next/link"
import { GitBranch } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AreaChartCard } from "@/components/charts/area-chart-card"

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

  await ensureTeam(orgId)

  const teamBlocks = await db.select().from(blocks).where(eq(blocks.teamId, orgId))
  const teamComps = await db.select().from(compositions).where(eq(compositions.teamId, orgId))
  const totalTokens = teamBlocks.reduce((sum, b) => sum + Math.round(b.content.length / 4), 0)

  // Assemblies in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentAssemblies = await db
    .select()
    .from(assemblyLogs)
    .where(and(eq(assemblyLogs.teamId, orgId), gte(assemblyLogs.assembledAt, oneDayAgo)))

  // Average score (non-null only)
  const allScores = await db
    .select()
    .from(scores)
    .where(and(eq(scores.teamId, orgId), isNotNull(scores.overallScore)))

  const avgScore = allScores.length > 0
    ? Math.round(allScores.reduce((sum, s) => sum + (s.overallScore ?? 0), 0) / allScores.length)
    : null

  // Assemblies over last 7 days for chart
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const weekAssemblies = await db
    .select()
    .from(assemblyLogs)
    .where(and(eq(assemblyLogs.teamId, orgId), gte(assemblyLogs.assembledAt, sevenDaysAgo)))

  const assemblyByDay = new Map<string, number>()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    assemblyByDay.set(d.toISOString().split("T")[0], 0)
  }
  for (const a of weekAssemblies) {
    const day = new Date(a.assembledAt).toISOString().split("T")[0]
    assemblyByDay.set(day, (assemblyByDay.get(day) ?? 0) + 1)
  }
  const assemblyChartData = Array.from(assemblyByDay.entries()).map(([date, count]) => ({
    label: date.slice(5),
    value: count,
  }))

  // Recent changes (last 5 audit log entries)
  const recentChanges = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.teamId, orgId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(5)

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
        <StatCard label="Compositions" value={teamComps.length} />
        <StatCard label="Blocks" value={teamBlocks.length} detail={`~${totalTokens.toLocaleString()} total tokens`} />
        <StatCard label="Assemblies / 24h" value={recentAssemblies.length} />
        <StatCard label="Avg Score" value={avgScore !== null ? `${avgScore}/100` : "—"} detail={avgScore !== null ? `${allScores.length} scores` : "No scores yet"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mb-6">
        <AreaChartCard title="Assemblies (last 7 days)" data={assemblyChartData} />
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3">Recent Changes</h3>
          {recentChanges.length === 0 ? (
            <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">No activity yet</div>
          ) : (
            <div className="space-y-2">
              {recentChanges.map((log) => (
                <div key={log.id} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium">{log.action}</span>
                    <span className="text-muted-foreground ml-1.5">{log.resourceType}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {new Date(log.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
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
