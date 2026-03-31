import { db } from "@/lib/db"
import { scores, compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc } from "drizzle-orm"
import { redirect } from "next/navigation"
import { ScrollText } from "lucide-react"
import { LogTable } from "@/components/logs/log-table"

export const dynamic = "force-dynamic"

export default async function LogsPage() {
  const { orgId } = await auth()
  if (!orgId) redirect("/")

  const recentScores = await db
    .select()
    .from(scores)
    .where(eq(scores.teamId, orgId))
    .orderBy(desc(scores.createdAt))
    .limit(100)

  const teamComps = await db
    .select()
    .from(compositions)
    .where(eq(compositions.teamId, orgId))

  const compNameMap = new Map(teamComps.map((c) => [c.id, c.name]))

  const logEntries = recentScores.map((score) => ({
    id: score.id,
    assemblyId: score.assemblyId,
    compositionId: score.compositionId,
    compositionName: compNameMap.get(score.compositionId) ?? score.compositionId.slice(0, 8),
    compositionVersion: score.compositionVersion,
    environment: score.environment,
    variantId: score.variantId,
    model: score.model,
    latencyMs: score.latencyMs,
    overallScore: score.overallScore,
    evalStatus: score.evalStatus,
    input: score.input,
    output: score.output,
    context: score.context,
    autoScores: score.autoScores as Record<string, any>,
    manualScores: score.manualScores as Record<string, any>,
    createdAt: score.createdAt.toISOString(),
  }))

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Logs</h1>

      {recentScores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <ScrollText className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
          <div className="text-sm font-medium text-muted-foreground">No logs yet</div>
          <div className="mt-1 text-[11px] text-muted-foreground/70">
            Call{" "}
            <code className="font-mono bg-muted px-1 rounded">pk.track()</code>{" "}
            from your app to start collecting assembly logs.
          </div>
        </div>
      ) : (
        <LogTable logs={JSON.parse(JSON.stringify(logEntries))} />
      )}
    </div>
  )
}
