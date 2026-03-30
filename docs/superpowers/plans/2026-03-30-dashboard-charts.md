# Dashboard & Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire real dashboard stats, add Recharts trend charts to 4 pages, and add cost estimation to analytics.

**Architecture:** Three reusable chart wrapper components around Recharts. Server components query data and pass pre-computed arrays to client chart components. Model cost lookup is a simple object map.

**Tech Stack:** Recharts, React, Next.js server components, Drizzle ORM

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `components/charts/area-chart-card.tsx` | Create | Reusable area chart in a card |
| `components/charts/line-chart-card.tsx` | Create | Reusable line chart in a card |
| `components/charts/bar-chart-card.tsx` | Create | Reusable bar chart in a card |
| `lib/model-costs.ts` | Create | Model cost-per-token lookup |
| `app/(app)/page.tsx` | Modify | Real stats, assemblies chart, recent changes |
| `app/(app)/analytics/page.tsx` | Modify | Token usage chart, cost estimation |
| `app/(app)/scoring/page.tsx` | Modify | Score trends chart |
| `app/(app)/experiments/page.tsx` | Modify | Variant score bar chart |

---

### Task 1: Create reusable chart components

**Files:**
- Create: `components/charts/area-chart-card.tsx`
- Create: `components/charts/line-chart-card.tsx`
- Create: `components/charts/bar-chart-card.tsx`

- [ ] **Step 1: Create area chart card**

Create `components/charts/area-chart-card.tsx`:

```tsx
"use client"

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

interface AreaChartCardProps {
  title: string
  data: Array<{ label: string; value: number }>
  color?: string
}

export function AreaChartCard({ title, data, color = "#7c3aed" }: AreaChartCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-xs font-semibold text-muted-foreground mb-3">{title}</h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
          No data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "8px",
                fontSize: "11px",
                color: "#e4e4e7",
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${title})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create line chart card**

Create `components/charts/line-chart-card.tsx`:

```tsx
"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

interface LineChartCardProps {
  title: string
  data: Array<{ label: string; value: number }>
  color?: string
  valueFormatter?: (v: number) => string
}

export function LineChartCard({ title, data, color = "#7c3aed", valueFormatter }: LineChartCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-xs font-semibold text-muted-foreground mb-3">{title}</h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
          No data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={valueFormatter}
            />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "8px",
                fontSize: "11px",
                color: "#e4e4e7",
              }}
              formatter={(value: number) => [valueFormatter ? valueFormatter(value) : value]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create bar chart card**

Create `components/charts/bar-chart-card.tsx`:

```tsx
"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

interface BarChartCardProps {
  title: string
  data: Array<{ label: string; value: number }>
  color?: string
}

export function BarChartCard({ title, data, color = "#7c3aed" }: BarChartCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-xs font-semibold text-muted-foreground mb-3">{title}</h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
          No data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "8px",
                fontSize: "11px",
                color: "#e4e4e7",
              }}
            />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/knid/Projects/promptkit
git add components/charts/
git commit -m "feat: add reusable Recharts card components (area, line, bar)"
```

---

### Task 2: Create model costs lookup

**Files:**
- Create: `lib/model-costs.ts`

- [ ] **Step 1: Create the lookup**

Create `lib/model-costs.ts`:

```typescript
// Cost per 1M tokens in USD
interface ModelCost {
  input: number
  output: number
}

const MODEL_COSTS: Record<string, ModelCost> = {
  "claude-sonnet-4-6-20250514": { input: 3, output: 15 },
  "claude-sonnet-4-5-20250514": { input: 3, output: 15 },
  "claude-opus-4-6-20250514": { input: 15, output: 75 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
}

export function estimateCost(
  model: string | null,
  inputTokens: number | null,
  outputTokens: number | null
): number {
  if (!model || (!inputTokens && !outputTokens)) return 0
  const costs = MODEL_COSTS[model]
  if (!costs) return 0
  return ((inputTokens ?? 0) * costs.input + (outputTokens ?? 0) * costs.output) / 1_000_000
}

export function formatCost(usd: number): string {
  if (usd === 0) return "$0"
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(2)}`
  return `$${usd.toFixed(2)}`
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/knid/Projects/promptkit
git add lib/model-costs.ts
git commit -m "feat: add model cost estimation lookup"
```

---

### Task 3: Wire real dashboard stats and add charts

**Files:**
- Modify: `app/(app)/page.tsx`

- [ ] **Step 1: Rewrite the dashboard page**

Replace the full content of `app/(app)/page.tsx`:

```tsx
import { db } from "@/lib/db"
import { blocks, compositions, assemblyLogs, scores, auditLogs } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { OrganizationSwitcher } from "@clerk/nextjs"
import { eq, gte, and, isNotNull, sql } from "drizzle-orm"
import { ensureTeam } from "@/lib/ensure-team"
import { StatCard } from "@/components/dashboard/stat-card"
import Link from "next/link"
import { GitBranch } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AreaChartCard } from "@/components/charts/area-chart-card"
import { desc } from "drizzle-orm"

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
    label: date.slice(5), // "MM-DD"
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
            <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
              No activity yet
            </div>
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
```

- [ ] **Step 2: Commit**

```bash
cd /home/knid/Projects/promptkit
git add "app/(app)/page.tsx"
git commit -m "feat: wire real dashboard stats, add assemblies chart and recent changes"
```

---

### Task 4: Analytics page — token usage chart and cost estimation

**Files:**
- Modify: `app/(app)/analytics/page.tsx`

- [ ] **Step 1: Rewrite analytics page with charts and costs**

Replace the full content of `app/(app)/analytics/page.tsx`:

```tsx
import { db } from "@/lib/db"
import { scores } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { BarChart3 } from "lucide-react"
import { StatCard } from "@/components/dashboard/stat-card"
import { mean } from "@/lib/statistics"
import { LineChartCard } from "@/components/charts/line-chart-card"
import { estimateCost, formatCost } from "@/lib/model-costs"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
  const { orgId } = await auth()
  if (!orgId) redirect("/")

  const allScores = await db
    .select()
    .from(scores)
    .where(eq(scores.teamId, orgId))

  const isEmpty = allScores.length === 0

  const totalTracked = allScores.length

  const latencyValues = allScores
    .map((s) => s.latencyMs)
    .filter((v): v is number => v !== null)
  const avgLatencyMs = latencyValues.length > 0 ? mean(latencyValues) : null

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentScores = allScores.filter((s) => new Date(s.createdAt) >= sevenDaysAgo)
  const tokens7d = recentScores.reduce((sum, s) => {
    return sum + (s.inputTokens ?? 0) + (s.outputTokens ?? 0)
  }, 0)

  const modelSet = new Set(allScores.map((s) => s.model).filter((m): m is string => m !== null))
  const distinctModels = modelSet.size

  // Cost estimation
  const totalCost = allScores.reduce((sum, s) => {
    return sum + estimateCost(s.model, s.inputTokens, s.outputTokens)
  }, 0)

  // Token usage over time (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const tokenByDay = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    tokenByDay.set(d.toISOString().split("T")[0], 0)
  }
  for (const s of allScores) {
    if (new Date(s.createdAt) < thirtyDaysAgo) continue
    const day = new Date(s.createdAt).toISOString().split("T")[0]
    const tokens = (s.inputTokens ?? 0) + (s.outputTokens ?? 0)
    tokenByDay.set(day, (tokenByDay.get(day) ?? 0) + tokens)
  }
  const tokenChartData = Array.from(tokenByDay.entries()).map(([date, count]) => ({
    label: date.slice(5),
    value: count,
  }))

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
            Call <code className="font-mono bg-muted px-1 rounded">pk.track()</code> from your app to start collecting analytics.
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 mb-6">
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
            <StatCard
              label="Est. Cost"
              value={totalCost > 0 ? formatCost(totalCost) : "—"}
              detail="all-time estimated"
            />
          </div>
          <LineChartCard title="Token Usage (last 30 days)" data={tokenChartData} color="#06b6d4" />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/knid/Projects/promptkit
git add "app/(app)/analytics/page.tsx"
git commit -m "feat: add token usage chart and cost estimation to analytics"
```

---

### Task 5: Scoring page — score trends chart

**Files:**
- Modify: `app/(app)/scoring/page.tsx`

- [ ] **Step 1: Add score trends chart**

In `app/(app)/scoring/page.tsx`, add the import at the top:
```typescript
import { LineChartCard } from "@/components/charts/line-chart-card"
```

After the existing `compositionStats` computation and before the return statement, add score trend data computation:

```typescript
  // Score trends over last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const scoreByDay = new Map<string, number[]>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    scoreByDay.set(d.toISOString().split("T")[0], [])
  }
  for (const s of recentScores) {
    if (s.overallScore === null) continue
    if (new Date(s.createdAt) < thirtyDaysAgo) continue
    const day = new Date(s.createdAt).toISOString().split("T")[0]
    const arr = scoreByDay.get(day)
    if (arr) arr.push(s.overallScore)
  }
  const scoreTrendData = Array.from(scoreByDay.entries()).map(([date, values]) => ({
    label: date.slice(5),
    value: values.length > 0 ? Math.round(mean(values)) : 0,
  }))
```

In the return statement, add the chart AFTER the `compositionStats` section (after the grid of StatCards), before the "Recent Scores" heading:

```tsx
<div className="mb-6">
  <LineChartCard title="Score Trends (last 30 days)" data={scoreTrendData} color="#22c55e" />
</div>
```

- [ ] **Step 2: Commit**

```bash
cd /home/knid/Projects/promptkit
git add "app/(app)/scoring/page.tsx"
git commit -m "feat: add score trends chart to scoring page"
```

---

### Task 6: Experiments page — variant score bar chart

**Files:**
- Modify: `app/(app)/experiments/page.tsx`

- [ ] **Step 1: Add bar chart to experiments**

In `app/(app)/experiments/page.tsx`, add the import:
```typescript
import { BarChartCard } from "@/components/charts/bar-chart-card"
```

In the return statement, after the experiments grid, add a chart showing all variants' mean scores. Add this block after the grid div (the one with `className="grid grid-cols-1 gap-4 lg:grid-cols-2"`) and before the closing fragment `</>` or closing div:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
cd /home/knid/Projects/promptkit
git add "app/(app)/experiments/page.tsx"
git commit -m "feat: add variant score bar chart to experiments page"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run all tests**

Run: `cd /home/knid/Projects/promptkit && npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: TypeScript check**

Run: `cd /home/knid/Projects/promptkit && npx tsc --noEmit 2>&1 | grep -v flow-canvas | head -20`
Expected: No new errors

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: address verification issues in dashboard and charts"
```
