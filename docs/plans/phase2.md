# PromptKit Phase 2: Scoring + Experiments

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic scoring, LLM-as-judge evaluation, A/B testing via Percentage IF nodes, and experiment analytics to PromptKit.

**Architecture:** New DB tables for scores and eval configs. Track/Score SDK endpoints receive LLM outputs. Layer 1 metrics are always-on. Layer 2 auto-eval runs LLM-as-judge on a sample. Percentage IF nodes enable A/B testing with deterministic user hashing. Experiments dashboard shows statistical significance.

**Tech Stack:** Same as Phase 1 + AI SDK for LLM-as-judge calls, recharts for analytics charts.

**Spec:** `docs/superpowers/specs/2026-03-30-promptkit-design.md` (Scoring System + A/B Testing sections)

**Repo:** `/home/knid/Projects/promptkit`

---

## File Structure (new/modified files only)

```
promptkit/
├── app/
│   ├── (app)/
│   │   ├── experiments/
│   │   │   └── page.tsx              # Experiments dashboard
│   │   ├── scoring/
│   │   │   └── page.tsx              # Score trends and analytics
│   │   └── analytics/
│   │       └── page.tsx              # Assembly volume, token usage charts
│   └── api/
│       ├── sdk/
│       │   ├── track/route.ts        # POST — receive LLM input/output
│       │   └── score/route.ts        # POST — receive manual metrics
│       └── eval/
│           └── run/route.ts          # POST — trigger auto-eval (internal)
├── components/
│   ├── editor/
│   │   └── nodes/
│   │       └── if-percentage-node.tsx # Percentage split node (A/B testing)
│   ├── experiments/
│   │   ├── experiment-card.tsx        # Single experiment with stats
│   │   └── confidence-badge.tsx       # Statistical significance indicator
│   └── analytics/
│       └── assembly-chart.tsx         # Recharts time-series chart
├── lib/
│   ├── schema.ts                     # Modified — add scores, evalConfigs tables
│   ├── hash.ts                       # Deterministic variant hashing
│   ├── eval-runner.ts                # LLM-as-judge execution logic
│   └── statistics.ts                 # p-value, confidence interval calculations
└── sdk/
    └── src/
        ├── compose.ts                # Modified — support ifPercentage node
        └── hash.ts                   # Deterministic hashing (shared with server)
```

---

## Task 1: Schema Additions

**Files:**
- Modify: `lib/schema.ts`

- [ ] **Step 1: Add new tables to schema**

Add these tables to `lib/schema.ts`:

```typescript
// ─── Scores (from pk.track + auto-eval) ───
export const scores = pgTable("scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").notNull().references(() => teams.id),
  assemblyId: text("assembly_id").notNull(), // from pk.track()
  compositionId: uuid("composition_id").notNull(),
  compositionVersion: integer("composition_version").notNull(),
  environment: envEnum("environment").notNull(),
  variantId: text("variant_id"), // which A/B variant was used
  context: jsonb("context"), // what context was passed
  // LLM interaction data
  input: text("input"), // user prompt
  output: text("output"), // LLM response
  model: text("model"),
  latencyMs: integer("latency_ms"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  // Scores
  autoScores: jsonb("auto_scores").notNull().default({}), // { "instruction_following": 8, "quality": 7 }
  manualScores: jsonb("manual_scores").notNull().default({}), // { "buildSuccess": true }
  overallScore: integer("overall_score"), // 0-100 composite
  // Status
  evalStatus: text("eval_status").notNull().default("pending"), // pending, completed, skipped
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ─── Eval Configs (per-composition auto-eval settings) ───
export const evalConfigs = pgTable("eval_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  compositionId: uuid("composition_id").notNull().references(() => compositions.id),
  scorerName: text("scorer_name").notNull(), // "instruction_following", "quality", etc.
  enabled: boolean("enabled").notNull().default(true),
  sampleRate: integer("sample_rate").notNull().default(20), // percentage 1-100
  judgeModel: text("judge_model").notNull().default("anthropic/claude-sonnet-4.6"),
  judgePrompt: text("judge_prompt"), // custom judge prompt (null = use default)
  weight: integer("weight").notNull().default(1), // for composite scoring
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})
```

- [ ] **Step 2: Generate and apply migration**

```bash
npx drizzle-kit generate
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: schema additions — scores and evalConfigs tables for Phase 2"
```

---

## Task 2: Deterministic Variant Hashing

**Files:**
- Create: `lib/hash.ts`
- Create: `sdk/src/hash.ts`

- [ ] **Step 1: Create hash utility**

Same file in both locations (server + SDK):

```typescript
// lib/hash.ts (and sdk/src/hash.ts)

/**
 * Deterministic hash for A/B variant assignment.
 * Given a seed (userId or sessionId) and variant count,
 * always returns the same bucket index.
 */
export function hashToBucket(seed: string, bucketCount: number): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash) % bucketCount
}

/**
 * Select a variant based on percentage weights.
 * weights: [50, 50] → 50/50 split
 * weights: [70, 30] → 70/30 split
 * Returns the index of the selected variant.
 */
export function selectVariant(seed: string, weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0)
  const bucket = hashToBucket(seed, total)
  let cumulative = 0
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i]
    if (bucket < cumulative) return i
  }
  return weights.length - 1
}
```

- [ ] **Step 2: Create test**

```typescript
// lib/hash.test.ts
import { describe, it, expect } from "vitest"
import { hashToBucket, selectVariant } from "./hash"

describe("hashToBucket", () => {
  it("returns deterministic results", () => {
    const a = hashToBucket("user-123", 100)
    const b = hashToBucket("user-123", 100)
    expect(a).toBe(b)
  })

  it("distributes across buckets", () => {
    const buckets = new Set<number>()
    for (let i = 0; i < 100; i++) {
      buckets.add(hashToBucket(`user-${i}`, 10))
    }
    expect(buckets.size).toBeGreaterThan(5) // should use most buckets
  })
})

describe("selectVariant", () => {
  it("returns deterministic variant for same seed", () => {
    const a = selectVariant("user-123", [50, 50])
    const b = selectVariant("user-123", [50, 50])
    expect(a).toBe(b)
  })

  it("respects weight distribution approximately", () => {
    let countA = 0
    let countB = 0
    for (let i = 0; i < 1000; i++) {
      const v = selectVariant(`user-${i}`, [70, 30])
      if (v === 0) countA++
      else countB++
    }
    // 70/30 split should be roughly in range
    expect(countA).toBeGreaterThan(500)
    expect(countA).toBeLessThan(900)
  })

  it("handles single variant", () => {
    expect(selectVariant("any", [100])).toBe(0)
  })
})
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run lib/hash.test.ts
git add -A
git commit -m "feat: deterministic variant hashing for A/B testing"
```

---

## Task 3: Percentage IF Node

**Files:**
- Create: `components/editor/nodes/if-percentage-node.tsx`
- Modify: `components/editor/flow-canvas.tsx`
- Modify: `lib/graph-engine.ts`
- Modify: `sdk/src/compose.ts`

- [ ] **Step 1: Create Percentage IF node component**

```tsx
// components/editor/nodes/if-percentage-node.tsx
"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"

interface IfPercentageData {
  variants: Array<{ name: string; weight: number }>
}

const variantColors = ["#4ade80", "#f59e0b", "#06b6d4", "#ec4899", "#8b5cf6"]

export function IfPercentageNode({ data }: NodeProps) {
  const { variants = [] } = data as IfPercentageData

  return (
    <div className="rounded-lg border-2 border-primary bg-primary/5 px-3 py-2 min-w-[150px]">
      <Handle type="target" position={Position.Left} className="!bg-primary !h-2 !w-2" />
      <div className="flex items-center gap-1.5 mb-1">
        <div className="flex h-4 w-4 items-center justify-center rounded bg-primary">
          <span className="text-[7px] font-bold text-white">%%</span>
        </div>
        <span className="text-[10px] font-semibold text-primary/80">A/B Split</span>
      </div>
      <div className="mt-1.5 flex flex-col gap-1">
        {variants.map((v, i) => (
          <div key={v.name} className="flex items-center gap-1.5">
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: variantColors[i % variantColors.length] }}
            />
            <span className="text-[9px] font-mono text-muted-foreground">
              {v.weight}% → {v.name}
            </span>
          </div>
        ))}
      </div>
      {variants.map((v, i) => (
        <Handle
          key={v.name}
          type="source"
          position={Position.Right}
          id={v.name}
          className="!h-2 !w-2"
          style={{
            top: `${35 + i * (50 / Math.max(variants.length, 1))}%`,
            background: variantColors[i % variantColors.length],
          }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Register in flow canvas**

Add to `components/editor/flow-canvas.tsx`:
```typescript
import { IfPercentageNode } from "./nodes/if-percentage-node"

// In nodeTypes:
const nodeTypes = {
  // ...existing
  ifPercentage: IfPercentageNode,
}
```

- [ ] **Step 3: Add ifPercentage handling to graph engine**

Add to the switch statement in `lib/graph-engine.ts` `assembleGraph()` function, and add `selectVariant` import from `./hash`:

```typescript
import { selectVariant } from "./hash"

// Inside the walk() switch:
case "ifPercentage": {
  const variants = (node.data.variants as Array<{ name: string; weight: number }>) ?? []
  const seed = context._req?.userId ?? context._req?.sessionId ?? context._sdk?.requestId ?? String(Date.now())
  const weights = variants.map(v => v.weight)
  const selectedIndex = selectVariant(seed, weights)
  const selectedVariant = variants[selectedIndex]
  if (selectedVariant) {
    const matchingEdges = (edgesBySource.get(node.id) ?? []).filter(
      (e) => e.sourceHandle === selectedVariant.name
    )
    for (const edge of matchingEdges) {
      walk(edge.target)
    }
  }
  return
}
```

- [ ] **Step 4: Add same logic to SDK compose.ts**

Add same ifPercentage case to `sdk/src/compose.ts` walk function. Import `selectVariant` from `./hash`. Also update the `ComposeResult` to include the selected variant name.

- [ ] **Step 5: Add tests for ifPercentage**

Add to `lib/graph-engine.test.ts`:

```typescript
// Percentage graph
const percentageGraph = {
  nodes: [
    { id: "start", type: "start", data: {} },
    { id: "if-pct", type: "ifPercentage", data: { variants: [{ name: "v1", weight: 50 }, { name: "v2", weight: 50 }] } },
    { id: "n-v1", type: "block", data: { blockId: "b-web" } },
    { id: "n-v2", type: "block", data: { blockId: "b-mobile" } },
    { id: "merge", type: "merge", data: {} },
    { id: "output", type: "output", data: {} },
  ],
  edges: [
    { id: "e1", source: "start", target: "if-pct" },
    { id: "e2", source: "if-pct", target: "n-v1", sourceHandle: "v1" },
    { id: "e3", source: "if-pct", target: "n-v2", sourceHandle: "v2" },
    { id: "e4", source: "n-v1", target: "merge" },
    { id: "e5", source: "n-v2", target: "merge" },
    { id: "e6", source: "merge", target: "output" },
  ],
}

it("selects a variant deterministically in percentage split", () => {
  const ctx = { _req: { userId: "user-42" } }
  const r1 = assembleGraph(percentageGraph.nodes, percentageGraph.edges, blocks, ctx)
  const r2 = assembleGraph(percentageGraph.nodes, percentageGraph.edges, blocks, ctx)
  expect(r1.blocks).toEqual(r2.blocks) // same user = same variant
  expect(r1.blocks.length).toBe(1) // only one branch taken
})
```

- [ ] **Step 6: Run all tests, commit**

```bash
npx vitest run
git add -A
git commit -m "feat: Percentage IF node for A/B testing with deterministic variant hashing"
```

---

## Task 4: Track + Score API Endpoints

**Files:**
- Create: `app/api/sdk/track/route.ts`
- Create: `app/api/sdk/score/route.ts`

- [ ] **Step 1: Create track endpoint**

```typescript
// app/api/sdk/track/route.ts
import { db } from "@/lib/db"
import { scores, apiKeys } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import crypto from "crypto"

async function authenticateSDK(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null
  const key = authHeader.slice(7)
  const hash = crypto.createHash("sha256").update(key).digest("hex")
  const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash))
  return apiKey ?? null
}

export async function POST(req: Request) {
  const apiKey = await authenticateSDK(req)
  if (!apiKey) return NextResponse.json({ error: "Invalid API key" }, { status: 401 })

  const body = await req.json()
  const { assemblyId, input, output, model, latencyMs, compositionId, compositionVersion, environment, variantId, context } = body

  const [score] = await db.insert(scores).values({
    teamId: apiKey.teamId,
    assemblyId,
    compositionId: compositionId ?? "unknown",
    compositionVersion: compositionVersion ?? 0,
    environment: environment ?? apiKey.environment,
    variantId,
    context,
    input,
    output,
    model,
    latencyMs,
    evalStatus: "pending",
  }).returning()

  return NextResponse.json({ id: score.id, evalStatus: "pending" }, { status: 201 })
}
```

- [ ] **Step 2: Create score endpoint (manual metrics)**

```typescript
// app/api/sdk/score/route.ts
import { db } from "@/lib/db"
import { scores, apiKeys } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import crypto from "crypto"

async function authenticateSDK(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null
  const key = authHeader.slice(7)
  const hash = crypto.createHash("sha256").update(key).digest("hex")
  const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash))
  return apiKey ?? null
}

export async function POST(req: Request) {
  const apiKey = await authenticateSDK(req)
  if (!apiKey) return NextResponse.json({ error: "Invalid API key" }, { status: 401 })

  const body = await req.json()
  const { assemblyId, metrics } = body

  const [existing] = await db
    .select()
    .from(scores)
    .where(eq(scores.assemblyId, assemblyId))

  if (existing) {
    await db.update(scores)
      .set({ manualScores: metrics })
      .where(eq(scores.id, existing.id))
    return NextResponse.json({ id: existing.id, updated: true })
  }

  // If no track() was called first, create a minimal score entry
  const [score] = await db.insert(scores).values({
    teamId: apiKey.teamId,
    assemblyId,
    compositionId: "unknown",
    compositionVersion: 0,
    environment: apiKey.environment,
    manualScores: metrics,
    evalStatus: "skipped",
  }).returning()

  return NextResponse.json({ id: score.id, created: true }, { status: 201 })
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: track and score SDK endpoints for receiving LLM outputs and manual metrics"
```

---

## Task 5: Statistics Utilities

**Files:**
- Create: `lib/statistics.ts`

- [ ] **Step 1: Create statistics module**

```typescript
// lib/statistics.ts

/**
 * Calculate mean of an array of numbers.
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * Calculate standard deviation.
 */
export function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  const squaredDiffs = values.map(v => (v - avg) ** 2)
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1))
}

/**
 * Two-sample t-test (Welch's t-test) for comparing two groups.
 * Returns { tStatistic, pValue, confidenceLevel }.
 * Used for A/B experiment analysis.
 */
export function welchTTest(
  groupA: number[],
  groupB: number[]
): { tStatistic: number; pValue: number; confidenceLevel: number } {
  const nA = groupA.length
  const nB = groupB.length

  if (nA < 2 || nB < 2) {
    return { tStatistic: 0, pValue: 1, confidenceLevel: 0 }
  }

  const meanA = mean(groupA)
  const meanB = mean(groupB)
  const varA = stddev(groupA) ** 2
  const varB = stddev(groupB) ** 2

  const se = Math.sqrt(varA / nA + varB / nB)
  if (se === 0) return { tStatistic: 0, pValue: 1, confidenceLevel: 0 }

  const t = (meanA - meanB) / se

  // Approximate p-value using normal distribution (good enough for large samples)
  const absT = Math.abs(t)
  // Using approximation: p ≈ 2 * e^(-0.717 * t - 0.416 * t^2) for |t| > 0
  const pValue = absT > 0
    ? Math.min(1, 2 * Math.exp(-0.717 * absT - 0.416 * absT * absT))
    : 1

  const confidenceLevel = Math.round((1 - pValue) * 100)

  return { tStatistic: t, pValue, confidenceLevel }
}

/**
 * Determine experiment status based on confidence level.
 */
export function experimentStatus(
  confidenceLevel: number,
  threshold: number = 95
): "too_early" | "trending" | "significant" {
  if (confidenceLevel >= threshold) return "significant"
  if (confidenceLevel >= 70) return "trending"
  return "too_early"
}
```

- [ ] **Step 2: Add tests**

```typescript
// lib/statistics.test.ts
import { describe, it, expect } from "vitest"
import { mean, stddev, welchTTest, experimentStatus } from "./statistics"

describe("mean", () => {
  it("calculates mean", () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3)
  })
  it("handles empty array", () => {
    expect(mean([])).toBe(0)
  })
})

describe("stddev", () => {
  it("calculates standard deviation", () => {
    const sd = stddev([2, 4, 4, 4, 5, 5, 7, 9])
    expect(sd).toBeCloseTo(2.138, 2)
  })
})

describe("welchTTest", () => {
  it("returns high confidence for clearly different groups", () => {
    const groupA = Array.from({ length: 50 }, () => 8 + Math.random())
    const groupB = Array.from({ length: 50 }, () => 5 + Math.random())
    const result = welchTTest(groupA, groupB)
    expect(result.confidenceLevel).toBeGreaterThan(90)
  })

  it("returns low confidence for similar groups", () => {
    const groupA = [5.0, 5.1, 4.9, 5.2, 4.8]
    const groupB = [5.1, 4.9, 5.0, 5.2, 4.8]
    const result = welchTTest(groupA, groupB)
    expect(result.confidenceLevel).toBeLessThan(50)
  })

  it("handles small samples gracefully", () => {
    const result = welchTTest([5], [3])
    expect(result.pValue).toBe(1)
  })
})

describe("experimentStatus", () => {
  it("returns significant above threshold", () => {
    expect(experimentStatus(96)).toBe("significant")
  })
  it("returns trending between 70-95", () => {
    expect(experimentStatus(80)).toBe("trending")
  })
  it("returns too_early below 70", () => {
    expect(experimentStatus(40)).toBe("too_early")
  })
})
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run lib/statistics.test.ts
git add -A
git commit -m "feat: statistics utilities — Welch's t-test for experiment analysis"
```

---

## Task 6: Experiments Dashboard Page

**Files:**
- Create: `components/experiments/experiment-card.tsx`
- Create: `components/experiments/confidence-badge.tsx`
- Create: `app/(app)/experiments/page.tsx`
- Modify: `components/layout/sidebar.tsx` (add Experiments nav item)

- [ ] **Step 1: Create confidence badge**

```tsx
// components/experiments/confidence-badge.tsx
import { cn } from "@/lib/utils"

interface ConfidenceBadgeProps {
  level: number // 0-100
  status: "too_early" | "trending" | "significant"
}

export function ConfidenceBadge({ level, status }: ConfidenceBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium",
      status === "significant" && "bg-success/10 text-success",
      status === "trending" && "bg-warning/10 text-warning",
      status === "too_early" && "bg-muted text-muted-foreground",
    )}>
      {level}% confidence
    </span>
  )
}
```

- [ ] **Step 2: Create experiment card**

```tsx
// components/experiments/experiment-card.tsx
import { ConfidenceBadge } from "./confidence-badge"
import type { experimentStatus } from "@/lib/statistics"

interface ExperimentCardProps {
  compositionName: string
  variants: Array<{
    name: string
    sampleSize: number
    meanScore: number
  }>
  confidenceLevel: number
  status: ReturnType<typeof experimentStatus>
  duration: string
  winner: string | null
}

export function ExperimentCard({
  compositionName, variants, confidenceLevel, status, duration, winner
}: ExperimentCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">{compositionName}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{duration}</p>
        </div>
        <ConfidenceBadge level={confidenceLevel} status={status} />
      </div>

      <div className="space-y-2">
        {variants.map((v) => (
          <div key={v.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${v.name === winner ? "bg-success" : "bg-muted-foreground/30"}`} />
              <span className="text-xs font-medium">{v.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground">n={v.sampleSize}</span>
              <span className="font-mono text-xs font-medium">{v.meanScore.toFixed(1)}</span>
            </div>
          </div>
        ))}
      </div>

      {winner && status === "significant" && (
        <div className="mt-3 rounded bg-success/5 px-2 py-1.5 text-xs text-success font-medium">
          {winner} is the winner — promote it?
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create experiments page**

```tsx
// app/(app)/experiments/page.tsx
import { db } from "@/lib/db"
import { scores, compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and, isNotNull, sql } from "drizzle-orm"
import { redirect } from "next/navigation"
import { welchTTest, experimentStatus, mean } from "@/lib/statistics"
import { ExperimentCard } from "@/components/experiments/experiment-card"

export const dynamic = "force-dynamic"

export default async function ExperimentsPage() {
  const { orgId } = await auth()
  if (!orgId) redirect("/sign-in")

  // Find all scores with variantIds (these are from A/B tests)
  const experimentScores = await db
    .select()
    .from(scores)
    .where(and(
      eq(scores.teamId, orgId),
      isNotNull(scores.variantId)
    ))

  // Group by compositionId + extract variant groups
  const grouped = new Map<string, Map<string, number[]>>()
  const compNames = new Map<string, string>()

  for (const s of experimentScores) {
    const key = s.compositionId
    if (!grouped.has(key)) grouped.set(key, new Map())
    const variants = grouped.get(key)!
    const variant = s.variantId ?? "default"
    if (!variants.has(variant)) variants.set(variant, [])
    if (s.overallScore !== null) {
      variants.get(variant)!.push(s.overallScore)
    }
  }

  // Get composition names
  const comps = await db.select().from(compositions).where(eq(compositions.teamId, orgId))
  for (const c of comps) compNames.set(c.id, c.name)

  // Build experiment data
  const experiments = Array.from(grouped.entries()).map(([compId, variantMap]) => {
    const variantEntries = Array.from(variantMap.entries())
    const variantData = variantEntries.map(([name, scores]) => ({
      name,
      sampleSize: scores.length,
      meanScore: mean(scores),
    }))

    let confidenceLevel = 0
    let winner: string | null = null

    if (variantEntries.length === 2 && variantEntries[0][1].length >= 2 && variantEntries[1][1].length >= 2) {
      const result = welchTTest(variantEntries[0][1], variantEntries[1][1])
      confidenceLevel = result.confidenceLevel
      if (confidenceLevel >= 70) {
        winner = variantData[0].meanScore > variantData[1].meanScore
          ? variantData[0].name : variantData[1].name
      }
    }

    const status = experimentStatus(confidenceLevel)

    return {
      compositionName: compNames.get(compId) ?? compId,
      variants: variantData,
      confidenceLevel,
      status,
      duration: "Active",
      winner,
    }
  })

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Experiments</h1>
      {experiments.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No active experiments. Add a Percentage IF node to a composition to start A/B testing.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {experiments.map((exp) => (
            <ExperimentCard key={exp.compositionName} {...exp} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add Experiments to sidebar**

In `components/layout/sidebar.tsx`, add to the navItems array:
```typescript
import { Beaker } from "lucide-react" // add to imports

// Add after Blocks:
{ href: "/experiments", label: "Experiments", icon: Beaker },
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: experiments dashboard with confidence levels, winner detection, Welch's t-test"
```

---

## Task 7: Scoring Page

**Files:**
- Create: `app/(app)/scoring/page.tsx`
- Modify: `components/layout/sidebar.tsx`

- [ ] **Step 1: Create scoring page**

```tsx
// app/(app)/scoring/page.tsx
import { db } from "@/lib/db"
import { scores, compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc, sql, and } from "drizzle-orm"
import { redirect } from "next/navigation"
import { mean } from "@/lib/statistics"

export const dynamic = "force-dynamic"

export default async function ScoringPage() {
  const { orgId } = await auth()
  if (!orgId) redirect("/sign-in")

  // Get recent scores
  const recentScores = await db
    .select()
    .from(scores)
    .where(eq(scores.teamId, orgId))
    .orderBy(desc(scores.createdAt))
    .limit(50)

  // Get compositions for name lookup
  const comps = await db.select().from(compositions).where(eq(compositions.teamId, orgId))
  const compNames = new Map(comps.map(c => [c.id, c.name]))

  // Calculate per-composition averages
  const byComposition = new Map<string, number[]>()
  for (const s of recentScores) {
    if (s.overallScore === null) continue
    const key = s.compositionId
    if (!byComposition.has(key)) byComposition.set(key, [])
    byComposition.get(key)!.push(s.overallScore)
  }

  const compositionStats = Array.from(byComposition.entries()).map(([compId, scores]) => ({
    name: compNames.get(compId) ?? compId,
    avgScore: mean(scores),
    count: scores.length,
  }))

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Scoring</h1>

      {compositionStats.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No scores yet. Use <code className="font-mono text-xs bg-secondary px-1 rounded">pk.track()</code> in your SDK to start collecting scores.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            {compositionStats.map((stat) => (
              <div key={stat.name} className="rounded-lg border border-border bg-card p-3">
                <div className="text-sm font-medium">{stat.name}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tracking-tight">
                    {stat.avgScore.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">avg score</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.count} evaluations</div>
              </div>
            ))}
          </div>

          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Recent Scores</h2>
          <div className="space-y-1">
            {recentScores.slice(0, 20).map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded border border-border bg-card px-3 py-2 text-xs">
                <span className="font-medium">{compNames.get(s.compositionId) ?? "—"}</span>
                <span className="font-mono text-muted-foreground">v{s.compositionVersion}</span>
                {s.variantId && <span className="rounded bg-warning/10 px-1.5 text-warning">{s.variantId}</span>}
                <span className="ml-auto font-mono">
                  {s.overallScore !== null ? `${s.overallScore}/100` : "pending"}
                </span>
                <span className="text-muted-foreground">{s.model ?? ""}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Scoring to sidebar**

In `components/layout/sidebar.tsx`, add:
```typescript
import { Target } from "lucide-react"

// Add after Experiments:
{ href: "/scoring", label: "Scoring", icon: Target },
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: scoring page with per-composition averages and recent score log"
```

---

## Task 8: Analytics Page

**Files:**
- Create: `app/(app)/analytics/page.tsx`
- Modify: `components/layout/sidebar.tsx`

- [ ] **Step 1: Install recharts**

```bash
npm install recharts
```

- [ ] **Step 2: Create analytics page**

```tsx
// app/(app)/analytics/page.tsx
import { db } from "@/lib/db"
import { scores, assemblyLogs } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc, sql, gte } from "drizzle-orm"
import { redirect } from "next/navigation"
import { StatCard } from "@/components/dashboard/stat-card"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
  const { orgId } = await auth()
  if (!orgId) redirect("/sign-in")

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Get score counts
  const allScores = await db
    .select()
    .from(scores)
    .where(eq(scores.teamId, orgId))

  const recentScores = allScores.filter(s => new Date(s.createdAt) >= sevenDaysAgo)

  // Calculate stats
  const totalTracked = allScores.length
  const trackedThisWeek = recentScores.length
  const avgLatency = recentScores.length > 0
    ? Math.round(recentScores.reduce((sum, s) => sum + (s.latencyMs ?? 0), 0) / recentScores.filter(s => s.latencyMs).length)
    : 0
  const totalTokens = recentScores.reduce((sum, s) => sum + (s.inputTokens ?? 0) + (s.outputTokens ?? 0), 0)
  const modelsUsed = new Set(recentScores.map(s => s.model).filter(Boolean))

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Analytics</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
        <StatCard label="Total Tracked" value={totalTracked} detail={`${trackedThisWeek} this week`} />
        <StatCard label="Avg Latency" value={avgLatency > 0 ? `${avgLatency}ms` : "—"} detail="LLM response time" />
        <StatCard label="Tokens (7d)" value={totalTokens > 0 ? totalTokens.toLocaleString() : "—"} detail="Input + output" />
        <StatCard label="Models" value={modelsUsed.size || "—"} detail={modelsUsed.size > 0 ? Array.from(modelsUsed).join(", ") : "Connect SDK"} />
      </div>

      {totalTracked === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No data yet. Use <code className="font-mono text-xs bg-secondary px-1 rounded">pk.track()</code> to start sending LLM outputs.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add Analytics to sidebar**

In `components/layout/sidebar.tsx`, add:
```typescript
import { BarChart3 } from "lucide-react"

// Add after Scoring:
{ href: "/analytics", label: "Analytics", icon: BarChart3 },
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: analytics page with tracked totals, latency, token usage stats"
```

---

## Summary

Phase 2 delivers:
- **8 tasks** covering scoring infrastructure, A/B testing, and analytics
- Percentage IF node for A/B split testing in the flow editor
- Deterministic variant hashing (consistent user assignment)
- Track + Score SDK endpoints
- Welch's t-test for statistical significance
- Experiments dashboard with confidence levels and winner detection
- Scoring page with per-composition averages
- Analytics page with latency, tokens, and model usage
- 3 new sidebar navigation items (Experiments, Scoring, Analytics)

**Not in Phase 2** (deferred to Phase 3):
- LLM-as-judge auto-eval runner (requires AI SDK integration)
- Custom scorers (code + LLM-as-judge)
- Composite scoring
- Score trend charts (recharts time series)
