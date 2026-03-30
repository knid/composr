import { db } from "@/lib/db"
import { usageRecords } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc, and, gte } from "drizzle-orm"
import { redirect } from "next/navigation"
import { Activity } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function UsagePage() {
  const { orgId } = await auth()
  if (!orgId) redirect("/")

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const records = await db
    .select()
    .from(usageRecords)
    .where(and(
      eq(usageRecords.teamId, orgId),
      gte(usageRecords.date, thirtyDaysAgo)
    ))
    .orderBy(desc(usageRecords.date))

  // Aggregate by date
  const byDate = new Map<string, { config: number; track: number; score: number; compose: number }>()
  for (const r of records) {
    const existing = byDate.get(r.date) ?? { config: 0, track: 0, score: 0, compose: 0 }
    const endpoint = r.endpoint as "config" | "track" | "score" | "compose"
    existing[endpoint] = (existing[endpoint] ?? 0) + r.count
    byDate.set(r.date, existing)
  }

  const dates = Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  const totalConfig = records.filter((r) => r.endpoint === "config").reduce((s, r) => s + r.count, 0)
  const totalTrack = records.filter((r) => r.endpoint === "track").reduce((s, r) => s + r.count, 0)
  const totalScore = records.filter((r) => r.endpoint === "score").reduce((s, r) => s + r.count, 0)
  const totalCompose = records.filter((r) => r.endpoint === "compose").reduce((s, r) => s + r.count, 0)

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Usage</h1>

      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Activity className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
          <div className="text-sm font-medium text-muted-foreground">No usage data yet</div>
          <div className="mt-1 text-[11px] text-muted-foreground/70">
            Usage is recorded when SDK endpoints are called.
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Config calls</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">{totalConfig.toLocaleString()}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">last 30 days</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Track calls</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">{totalTrack.toLocaleString()}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">last 30 days</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Score calls</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">{totalScore.toLocaleString()}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">last 30 days</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Compose calls</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">{totalCompose.toLocaleString()}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">last 30 days</div>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Config</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Track</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Score</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Compose</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {dates.map(([date, counts]) => (
                  <tr key={date} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{date}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{counts.config || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{counts.track || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{counts.score || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{counts.compose || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {counts.config + counts.track + counts.score + counts.compose}
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
