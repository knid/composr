import { db } from "@/lib/db"
import { scores, compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc } from "drizzle-orm"
import { redirect } from "next/navigation"
import { ScrollText } from "lucide-react"
import { Badge } from "@/components/ui/badge"

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

  function formatTime(date: Date) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(date))
  }

  function formatLatency(ms: number | null) {
    if (ms === null) return "—"
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
    return `${ms}ms`
  }

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
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Composition</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Version</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Variant</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Model</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Latency</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Score</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Eval Status</th>
              </tr>
            </thead>
            <tbody>
              {recentScores.map((score) => (
                <tr key={score.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatTime(score.createdAt)}
                  </td>
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
                  <td className="px-3 py-2 text-muted-foreground">{score.model ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatLatency(score.latencyMs)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {score.overallScore !== null ? (
                      <span className="font-medium">{score.overallScore}/100</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {score.evalStatus === "completed" ? (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-green-500/10 text-green-500">
                        completed
                      </span>
                    ) : score.evalStatus === "pending" ? (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-yellow-500/10 text-yellow-500">
                        pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                        {score.evalStatus}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
