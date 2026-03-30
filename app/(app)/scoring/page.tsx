import { db } from "@/lib/db"
import { scores, compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc } from "drizzle-orm"
import { redirect } from "next/navigation"
import { Target } from "lucide-react"
import { StatCard } from "@/components/dashboard/stat-card"
import { mean } from "@/lib/statistics"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

export default async function ScoringPage() {
  const { orgId } = await auth()
  if (!orgId) redirect("/sign-in")

  // Fetch recent scores (limit 50)
  const recentScores = await db
    .select()
    .from(scores)
    .where(eq(scores.teamId, orgId))
    .orderBy(desc(scores.createdAt))
    .limit(50)

  // Fetch all compositions for name lookup
  const teamComps = await db
    .select()
    .from(compositions)
    .where(eq(compositions.teamId, orgId))

  const compNameMap = new Map(teamComps.map((c) => [c.id, c.name]))

  // Group all scores by compositionId for per-composition averages
  const byComposition = new Map<string, number[]>()
  for (const score of recentScores) {
    if (score.overallScore === null) continue
    const existing = byComposition.get(score.compositionId) ?? []
    existing.push(score.overallScore)
    byComposition.set(score.compositionId, existing)
  }

  const compositionStats = Array.from(byComposition.entries()).map(([compositionId, values]) => ({
    compositionId,
    name: compNameMap.get(compositionId) ?? compositionId,
    avgScore: mean(values),
    count: values.length,
  }))

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Scoring</h1>

      {recentScores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Target className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
          <div className="text-sm font-medium text-muted-foreground">No scores yet</div>
          <div className="mt-1 text-[11px] text-muted-foreground/70">
            Call{" "}
            <code className="font-mono bg-muted px-1 rounded">pk.track(&#123; score: 0.9 &#125;)</code>{" "}
            in your app to start collecting scores.
          </div>
        </div>
      ) : (
        <>
          {compositionStats.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">By Composition</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
                {compositionStats.map((stat) => (
                  <StatCard
                    key={stat.compositionId}
                    label={stat.name}
                    value={`${stat.avgScore.toFixed(1)}/100`}
                    detail={`${stat.count} score${stat.count !== 1 ? "s" : ""}`}
                  />
                ))}
              </div>
            </>
          )}

          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Recent Scores</h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Composition</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Version</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Variant</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Score</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Model</th>
                </tr>
              </thead>
              <tbody>
                {recentScores.map((score) => (
                  <tr key={score.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">
                      {compNameMap.get(score.compositionId) ?? score.compositionId.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">v{score.compositionVersion}</td>
                    <td className="px-3 py-2">
                      {score.variantId ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {score.variantId}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {score.overallScore !== null ? (
                        <span className="font-medium">{score.overallScore}/100</span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {score.model ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
