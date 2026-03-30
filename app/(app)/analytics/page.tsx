import { db } from "@/lib/db"
import { scores } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { BarChart3 } from "lucide-react"
import { StatCard } from "@/components/dashboard/stat-card"
import { mean } from "@/lib/statistics"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
  const { orgId } = await auth()
  if (!orgId) redirect("/")

  const allScores = await db
    .select()
    .from(scores)
    .where(eq(scores.teamId, orgId))

  const isEmpty = allScores.length === 0

  // Total tracked
  const totalTracked = allScores.length

  // Avg latency (exclude nulls)
  const latencyValues = allScores
    .map((s) => s.latencyMs)
    .filter((v): v is number => v !== null)
  const avgLatencyMs = latencyValues.length > 0 ? mean(latencyValues) : null

  // Tokens in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentScores = allScores.filter((s) => new Date(s.createdAt) >= sevenDaysAgo)
  const tokens7d = recentScores.reduce((sum, s) => {
    return sum + (s.inputTokens ?? 0) + (s.outputTokens ?? 0)
  }, 0)

  // Distinct models used
  const modelSet = new Set(allScores.map((s) => s.model).filter((m): m is string => m !== null))
  const distinctModels = modelSet.size

  const formatLatency =
    avgLatencyMs !== null
      ? avgLatencyMs >= 1000
        ? `${(avgLatencyMs / 1000).toFixed(1)}s`
        : `${Math.round(avgLatencyMs)}ms`
      : "—"

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Analytics</h1>

      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
          <div className="text-sm font-medium text-muted-foreground">No data yet</div>
          <div className="mt-1 text-[11px] text-muted-foreground/70">
            Call{" "}
            <code className="font-mono bg-muted px-1 rounded">pk.track()</code>{" "}
            from your app to start collecting analytics.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Total Tracked"
            value={totalTracked.toLocaleString()}
            detail="all-time score events"
          />
          <StatCard
            label="Avg Latency"
            value={formatLatency}
            detail={latencyValues.length > 0 ? `${latencyValues.length} samples` : "no data"}
          />
          <StatCard
            label="Tokens (7d)"
            value={tokens7d > 0 ? tokens7d.toLocaleString() : "—"}
            detail={`${recentScores.length} events in last 7 days`}
          />
          <StatCard
            label="Models"
            value={distinctModels > 0 ? distinctModels : "—"}
            detail={distinctModels > 0 ? Array.from(modelSet).slice(0, 2).join(", ") : "no model data"}
          />
        </div>
      )}
    </div>
  )
}
