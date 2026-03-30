import { db } from "@/lib/db"
import { scores, compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, isNotNull, and } from "drizzle-orm"
import { redirect } from "next/navigation"
import { Beaker } from "lucide-react"
import { ExperimentCard } from "@/components/experiments/experiment-card"
import { BarChartCard } from "@/components/charts/bar-chart-card"
import { welchTTest, experimentStatus, mean } from "@/lib/statistics"
export const dynamic = "force-dynamic"

export default async function ExperimentsPage() {
  const { orgId } = await auth()
  if (!orgId) redirect("/")

  // Fetch scores that have a variantId (experiment scores only)
  const experimentScores = await db
    .select()
    .from(scores)
    .where(and(eq(scores.teamId, orgId), isNotNull(scores.variantId)))

  // Fetch all compositions for name lookup
  const teamComps = await db
    .select()
    .from(compositions)
    .where(eq(compositions.teamId, orgId))

  const compNameMap = new Map(teamComps.map((c) => [c.id, c.name]))

  // Group scores by compositionId
  const byComposition = new Map<string, typeof experimentScores>()
  for (const score of experimentScores) {
    const existing = byComposition.get(score.compositionId) ?? []
    existing.push(score)
    byComposition.set(score.compositionId, existing)
  }

  // Build experiment data for each composition
  const experiments = Array.from(byComposition.entries()).map(([compositionId, compScores]) => {
    // Group by variantId
    const byVariant = new Map<string, typeof compScores>()
    for (const s of compScores) {
      const vid = s.variantId!
      const existing = byVariant.get(vid) ?? []
      existing.push(s)
      byVariant.set(vid, existing)
    }

    const variantIds = Array.from(byVariant.keys())

    // Compute per-variant scores
    const variantData = variantIds.map((vid) => {
      const variantScores = byVariant.get(vid)!
      const scoreValues = variantScores
        .map((s) => s.overallScore)
        .filter((v): v is number => v !== null)
      return { id: vid, name: vid, scores: scoreValues }
    })

    // Run Welch t-test for two-variant experiments
    let confidenceLevel = 0
    let status: "too_early" | "trending" | "significant" = "too_early"
    let winnerVariantId: string | null = null

    if (variantData.length === 2 && variantData[0].scores.length > 0 && variantData[1].scores.length > 0) {
      const result = welchTTest(variantData[0].scores, variantData[1].scores)
      confidenceLevel = result.confidenceLevel
      status = experimentStatus(confidenceLevel)

      const meanA = mean(variantData[0].scores)
      const meanB = mean(variantData[1].scores)
      if (status === "significant") {
        winnerVariantId = meanA >= meanB ? variantData[0].id : variantData[1].id
      }
    }

    // Calculate duration from earliest to latest score
    const dates = compScores.map((s) => new Date(s.createdAt))
    const earliest = new Date(Math.min(...dates.map((d) => d.getTime())))
    const latest = new Date(Math.max(...dates.map((d) => d.getTime())))
    const durationDays = Math.max(1, Math.ceil((latest.getTime() - earliest.getTime()) / 86_400_000) + 1)

    const variants = variantData.map((v) => ({
      id: v.id,
      name: v.name,
      sampleSize: v.scores.length,
      meanScore: v.scores.length > 0 ? mean(v.scores) : 0,
      isWinner: v.id === winnerVariantId,
    }))

    return {
      compositionId,
      compositionName: compNameMap.get(compositionId) ?? compositionId,
      durationDays,
      confidenceLevel,
      status,
      variants,
    }
  })

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Experiments</h1>

      {experiments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Beaker className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
          <div className="text-sm font-medium text-muted-foreground">No experiments yet</div>
          <div className="mt-1 text-[11px] text-muted-foreground/70">
            Pass a <code className="font-mono bg-muted px-1 rounded">variantId</code> when calling{" "}
            <code className="font-mono bg-muted px-1 rounded">pk.track()</code> to start an experiment.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {experiments.map((exp) => (
            <ExperimentCard key={exp.compositionId} {...exp} />
          ))}
        </div>
        {experiments.length > 0 && (
          <div className="mt-6">
            <BarChartCard
              title="Mean Score by Variant"
              data={experiments.flatMap((exp) =>
                exp.variants.map((v) => ({
                  label: `${exp.compositionName.slice(0, 12)}:${v.name.slice(0, 10)}`,
                  value: Math.round(v.meanScore),
                }))
              )}
              color="#f59e0b"
            />
          </div>
        )}
      )}
    </div>
  )
}
