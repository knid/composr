# Batch 2: Safety & Trust Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add impact analysis, prompt diff, and soft approval gate so teams trust remote prompt editing enough to move production prompts into Composr.

**Architecture:** All query-driven on existing data. Impact analysis scans composition graphs for block references. Prompt diff uses a line-based LCS algorithm on assembled text from composition versions. Soft approval gate adds a diff preview + confirmation to the deploy dialog for prod. One new utility (`lib/diff.ts`), two new API routes, two new UI components, and modifications to the block list and composition editor.

**Tech Stack:** Next.js 16, React 19, Drizzle ORM, Vitest.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `lib/diff.ts` | Line-based diff algorithm (LCS), returns added/removed/unchanged |
| `lib/diff.test.ts` | Tests for diff utility |
| `app/api/blocks/[id]/usage/route.ts` | Block impact analysis — which compositions use this block |
| `app/api/compositions/[id]/assemble/route.ts` | Assemble a composition version's graph into text (for diff) |
| `components/editor/version-diff.tsx` | Side-by-side diff display component |

### Modified Files
| File | Changes |
|------|---------|
| `components/blocks/block-list.tsx` | Add "Used in" section with prod warning to edit dialog |
| `components/compositions/composition-editor.tsx` | Version compare UI in history dialog, prod deploy confirmation with diff |

---

### Task 1: Diff Utility

**Files:**
- Create: `lib/diff.ts`
- Create: `lib/diff.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/diff.test.ts
import { describe, it, expect } from "vitest"
import { diffLines } from "./diff"

describe("diffLines", () => {
  it("returns unchanged for identical text", () => {
    const result = diffLines("hello\nworld", "hello\nworld")
    expect(result).toEqual([
      { type: "unchanged", text: "hello" },
      { type: "unchanged", text: "world" },
    ])
  })

  it("detects added lines", () => {
    const result = diffLines("hello", "hello\nworld")
    expect(result).toEqual([
      { type: "unchanged", text: "hello" },
      { type: "added", text: "world" },
    ])
  })

  it("detects removed lines", () => {
    const result = diffLines("hello\nworld", "hello")
    expect(result).toEqual([
      { type: "unchanged", text: "hello" },
      { type: "removed", text: "world" },
    ])
  })

  it("handles complete replacement", () => {
    const result = diffLines("foo\nbar", "baz\nqux")
    expect(result).toEqual([
      { type: "removed", text: "foo" },
      { type: "removed", text: "bar" },
      { type: "added", text: "baz" },
      { type: "added", text: "qux" },
    ])
  })

  it("handles mixed changes", () => {
    const result = diffLines(
      "line1\nline2\nline3\nline4",
      "line1\nchanged\nline3\nnew line\nline4"
    )
    // line1 unchanged, line2 removed, changed added, line3 unchanged, new line added, line4 unchanged
    expect(result.filter(d => d.type === "unchanged").map(d => d.text)).toEqual(["line1", "line3", "line4"])
    expect(result.filter(d => d.type === "removed").map(d => d.text)).toEqual(["line2"])
    expect(result.filter(d => d.type === "added").map(d => d.text)).toEqual(["changed", "new line"])
  })

  it("handles empty inputs", () => {
    expect(diffLines("", "hello")).toEqual([{ type: "added", text: "hello" }])
    expect(diffLines("hello", "")).toEqual([{ type: "removed", text: "hello" }])
    expect(diffLines("", "")).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/diff.test.ts`
Expected: FAIL — module `./diff` not found

- [ ] **Step 3: Write the implementation**

```typescript
// lib/diff.ts
export interface DiffLine {
  type: "added" | "removed" | "unchanged"
  text: string
}

/**
 * Compute a line-by-line diff using the LCS (Longest Common Subsequence) algorithm.
 * Returns an ordered array of added, removed, and unchanged lines.
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText ? oldText.split("\n") : []
  const newLines = newText ? newText.split("\n") : []

  const m = oldLines.length
  const n = newLines.length

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = []
  let i = m
  let j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: "unchanged", text: oldLines[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "added", text: newLines[j - 1] })
      j--
    } else {
      result.push({ type: "removed", text: oldLines[i - 1] })
      i--
    }
  }

  return result.reverse()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/diff.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/diff.ts lib/diff.test.ts
git commit -m "feat: add line-based diff utility"
```

---

### Task 2: Block Usage API

**Files:**
- Create: `app/api/blocks/[id]/usage/route.ts`

- [ ] **Step 1: Create the usage endpoint**

```typescript
// app/api/blocks/[id]/usage/route.ts
import { db } from "@/lib/db"
import { compositions, deployments } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id: blockId } = await params

  // Fetch all team compositions
  const teamComps = await db
    .select()
    .from(compositions)
    .where(eq(compositions.teamId, orgId))

  // Fetch all deployments to know which envs each composition is in
  const allDeployments = await db
    .select()
    .from(deployments)
    .orderBy(desc(deployments.deployedAt))

  // Build a map of compositionId → deployed environments (latest per env)
  const deployedEnvs = new Map<string, Set<string>>()
  for (const d of allDeployments) {
    if (!deployedEnvs.has(d.compositionId)) {
      deployedEnvs.set(d.compositionId, new Set())
    }
    deployedEnvs.get(d.compositionId)!.add(d.environment)
  }

  // Scan each composition's graph for nodes referencing this block
  const usage: Array<{
    compositionId: string
    compositionName: string
    nodeCount: number
    environments: string[]
  }> = []

  for (const comp of teamComps) {
    const graph = comp.graph as { nodes: any[]; edges: any[] }
    const matchingNodes = (graph.nodes ?? []).filter(
      (n: any) => (n.type === "block" || n.type === "tool") && n.data?.blockId === blockId
    )
    if (matchingNodes.length > 0) {
      usage.push({
        compositionId: comp.id,
        compositionName: comp.name,
        nodeCount: matchingNodes.length,
        environments: Array.from(deployedEnvs.get(comp.id) ?? []),
      })
    }
  }

  return NextResponse.json(usage)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/blocks/[id]/usage/route.ts
git commit -m "feat: add block usage/impact analysis API"
```

---

### Task 3: Impact Analysis in Block Edit Dialog

**Files:**
- Modify: `components/blocks/block-list.tsx`

- [ ] **Step 1: Add usage state and fetch to the block list**

In `components/blocks/block-list.tsx`, add new state variables after the existing edit state (around line 41):

```typescript
const [blockUsage, setBlockUsage] = useState<Array<{ compositionId: string; compositionName: string; nodeCount: number; environments: string[] }>>([])
const [loadingUsage, setLoadingUsage] = useState(false)
```

- [ ] **Step 2: Fetch usage when edit dialog opens**

Update the `openEdit` function to also fetch usage. Add after the versions fetch:

```typescript
setBlockUsage([])
setLoadingUsage(true)
fetch(`/api/blocks/${block.id}/usage`)
  .then((r) => r.json())
  .then((data) => { if (Array.isArray(data)) setBlockUsage(data) })
  .catch(() => {})
  .finally(() => setLoadingUsage(false))
```

- [ ] **Step 3: Add "Used in" section to the edit dialog**

Add `AlertTriangle` to the lucide-react import. In the edit dialog, add a "Used in" section at the TOP of the `<div className="space-y-3">` block (before the Name field):

```tsx
{/* Used in (impact analysis) */}
{blockUsage.length > 0 && (
  <div className={cn(
    "rounded-lg border p-3",
    blockUsage.some(u => u.environments.includes("prod"))
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-border bg-card"
  )}>
    <div className="flex items-center gap-1.5 mb-2">
      {blockUsage.some(u => u.environments.includes("prod")) && (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
      )}
      <span className="text-xs font-medium text-muted-foreground">
        Used in {blockUsage.length} composition{blockUsage.length !== 1 ? "s" : ""}
      </span>
    </div>
    <div className="space-y-1">
      {blockUsage.map((u) => (
        <div key={u.compositionId} className="flex items-center justify-between">
          <a
            href={`/compositions/${u.compositionId}`}
            className="text-xs text-primary hover:underline"
            onClick={(e) => { e.stopPropagation() }}
          >
            {u.compositionName}
          </a>
          <div className="flex gap-1">
            {u.environments.map((env) => (
              <span
                key={env}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[9px] font-medium",
                  env === "prod" ? "bg-red-500/10 text-red-500" :
                  env === "staging" ? "bg-yellow-500/10 text-yellow-500" :
                  "bg-green-500/10 text-green-500"
                )}
              >
                {env}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
    {blockUsage.some(u => u.environments.includes("prod")) && (
      <p className="text-[10px] text-amber-500 mt-2">
        Changes will take effect on next SDK sync
      </p>
    )}
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add components/blocks/block-list.tsx
git commit -m "feat: show block impact analysis in edit dialog"
```

---

### Task 4: Version Diff Display Component

**Files:**
- Create: `components/editor/version-diff.tsx`

- [ ] **Step 1: Create the diff component**

```tsx
// components/editor/version-diff.tsx
"use client"

import { cn } from "@/lib/utils"
import type { DiffLine } from "@/lib/diff"

interface VersionDiffProps {
  diff: DiffLine[]
  leftLabel: string
  rightLabel: string
}

export function VersionDiff({ diff, leftLabel, rightLabel }: VersionDiffProps) {
  const leftLines: Array<{ num: number | null; text: string; type: DiffLine["type"] }> = []
  const rightLines: Array<{ num: number | null; text: string; type: DiffLine["type"] }> = []

  let leftNum = 0
  let rightNum = 0

  for (const line of diff) {
    if (line.type === "unchanged") {
      leftNum++
      rightNum++
      leftLines.push({ num: leftNum, text: line.text, type: "unchanged" })
      rightLines.push({ num: rightNum, text: line.text, type: "unchanged" })
    } else if (line.type === "removed") {
      leftNum++
      leftLines.push({ num: leftNum, text: line.text, type: "removed" })
      rightLines.push({ num: null, text: "", type: "removed" })
    } else {
      rightNum++
      leftLines.push({ num: null, text: "", type: "added" })
      rightLines.push({ num: rightNum, text: line.text, type: "added" })
    }
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex border-b border-border text-[10px] font-medium text-muted-foreground">
        <div className="flex-1 px-3 py-1.5 border-r border-border bg-red-500/5">{leftLabel}</div>
        <div className="flex-1 px-3 py-1.5 bg-green-500/5">{rightLabel}</div>
      </div>
      <div className="flex max-h-[300px] overflow-y-auto">
        <div className="flex-1 border-r border-border">
          {leftLines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "flex font-mono text-[11px] leading-5 min-h-[20px]",
                line.type === "removed" && "bg-red-500/10",
                line.type === "added" && "bg-transparent",
              )}
            >
              <span className="w-8 text-right pr-2 text-muted-foreground/50 select-none shrink-0">
                {line.num ?? ""}
              </span>
              <span className={cn(
                "flex-1 px-2 whitespace-pre-wrap break-all",
                line.type === "removed" && "text-red-400",
                line.type === "added" && "text-transparent",
              )}>
                {line.text}
              </span>
            </div>
          ))}
        </div>
        <div className="flex-1">
          {rightLines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "flex font-mono text-[11px] leading-5 min-h-[20px]",
                line.type === "added" && "bg-green-500/10",
                line.type === "removed" && "bg-transparent",
              )}
            >
              <span className="w-8 text-right pr-2 text-muted-foreground/50 select-none shrink-0">
                {line.num ?? ""}
              </span>
              <span className={cn(
                "flex-1 px-2 whitespace-pre-wrap break-all",
                line.type === "added" && "text-green-400",
                line.type === "removed" && "text-transparent",
              )}>
                {line.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/editor/version-diff.tsx
git commit -m "feat: add side-by-side version diff component"
```

---

### Task 5: Assemble API Endpoint

**Files:**
- Create: `app/api/compositions/[id]/assemble/route.ts`

- [ ] **Step 1: Create the assemble endpoint**

```typescript
// app/api/compositions/[id]/assemble/route.ts
import { db } from "@/lib/db"
import { blocks, compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"
import { assembleGraph } from "@/lib/graph-engine"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const { graph } = body

  if (!graph?.nodes || !graph?.edges) {
    return NextResponse.json({ error: "graph with nodes and edges is required" }, { status: 400 })
  }

  // Verify composition belongs to team
  const [comp] = await db
    .select()
    .from(compositions)
    .where(and(eq(compositions.id, id), eq(compositions.teamId, orgId)))

  if (!comp) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Get all blocks for assembly
  const teamBlocks = await db.select().from(blocks).where(eq(blocks.teamId, orgId))
  const blockLookup: Record<string, { content: string; name: string; role?: string | null; kind?: string; description?: string | null }> = {}
  for (const b of teamBlocks) {
    blockLookup[b.id] = { content: b.content, name: b.name, role: b.role, kind: b.kind, description: b.description }
  }

  const result = assembleGraph(graph.nodes, graph.edges, blockLookup, {})

  return NextResponse.json({
    text: result.text,
    messages: result.messages,
    blocks: result.blocks,
    tools: result.tools,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/compositions/[id]/assemble/route.ts
git commit -m "feat: add composition assembly endpoint for diff preview"
```

---

### Task 6: Version Compare in History Dialog

**Files:**
- Modify: `components/compositions/composition-editor.tsx`

- [ ] **Step 1: Add compare state and imports**

In `components/compositions/composition-editor.tsx`, add these imports at the top:

```typescript
import { VersionDiff } from "@/components/editor/version-diff"
import { diffLines } from "@/lib/diff"
```

Add new state after the existing history state:

```typescript
const [compareVersions, setCompareVersions] = useState<[number, number] | null>(null)
const [diffResult, setDiffResult] = useState<Array<{ type: "added" | "removed" | "unchanged"; text: string }> | null>(null)
const [loadingDiff, setLoadingDiff] = useState(false)
```

- [ ] **Step 2: Add compare function**

Add this function after `rollbackTo`:

```typescript
async function compareVersions(v1: number, v2: number) {
  const [older, newer] = v1 < v2 ? [v1, v2] : [v2, v1]
  setCompareVersions([older, newer])
  setLoadingDiff(true)
  setDiffResult(null)

  try {
    const olderVersion = compVersions.find((v) => v.version === older)
    const newerVersion = compVersions.find((v) => v.version === newer)
    if (!olderVersion || !newerVersion) return

    const [olderRes, newerRes] = await Promise.all([
      fetch(`/api/compositions/${id}/assemble`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph: olderVersion.graph }),
      }).then((r) => r.json()),
      fetch(`/api/compositions/${id}/assemble`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph: newerVersion.graph }),
      }).then((r) => r.json()),
    ])

    setDiffResult(diffLines(olderRes.text, newerRes.text))
  } catch {
    setDiffResult(null)
  }
  setLoadingDiff(false)
}
```

- [ ] **Step 3: Update the history dialog UI**

Replace the existing history dialog content (the `<Dialog open={historyOpen} ...>` block) with:

```tsx
<Dialog open={historyOpen} onOpenChange={(open) => {
  setHistoryOpen(open)
  if (!open) { setCompareVersions(null); setDiffResult(null); setSelectedForCompare([]) }
}}>
  <DialogContent className={compareVersions ? "max-w-3xl" : ""}>
    <DialogHeader>
      <DialogTitle>
        {compareVersions ? `Comparing v${compareVersions[0]} → v${compareVersions[1]}` : "Version History"}
      </DialogTitle>
    </DialogHeader>

    {compareVersions && diffResult ? (
      <div className="space-y-3">
        <VersionDiff
          diff={diffResult}
          leftLabel={`v${compareVersions[0]}`}
          rightLabel={`v${compareVersions[1]}`}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setCompareVersions(null); setDiffResult(null); setSelectedForCompare([]) }}
        >
          Back to history
        </Button>
      </div>
    ) : compareVersions && loadingDiff ? (
      <p className="text-sm text-muted-foreground">Computing diff...</p>
    ) : loadingHistory ? (
      <p className="text-sm text-muted-foreground">Loading...</p>
    ) : compVersions.length === 0 ? (
      <p className="text-sm text-muted-foreground">No version history available.</p>
    ) : (
      <div className="space-y-2">
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {compVersions.map((v) => {
            const nodeCount = v.graph?.nodes?.length ?? 0
            const blockCount = v.graph?.nodes?.filter((n: any) => n.type === "block").length ?? 0
            const isSelected = selectedForCompare.includes(v.version)
            return (
              <div
                key={v.version}
                className={cn(
                  "flex items-center justify-between rounded-lg border bg-card p-3",
                  isSelected ? "border-primary" : "border-border"
                )}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      setSelectedForCompare((prev) => {
                        if (prev.includes(v.version)) return prev.filter((x) => x !== v.version)
                        if (prev.length >= 2) return [prev[1], v.version]
                        return [...prev, v.version]
                      })
                    }}
                    className="rounded"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">v{v.version}</span>
                      {v.version === version && (
                        <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] text-success font-medium">
                          current
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(v.createdAt).toLocaleString()} · {blockCount} blocks · {nodeCount} nodes
                    </div>
                  </div>
                </div>
                {v.version !== version && (
                  <Button size="sm" variant="outline" onClick={() => rollbackTo(v.version)}>
                    Restore
                  </Button>
                )}
              </div>
            )
          })}
        </div>
        {selectedForCompare.length === 2 && (
          <Button
            size="sm"
            onClick={() => compareVersions(selectedForCompare[0], selectedForCompare[1])}
          >
            Compare v{Math.min(...selectedForCompare)} → v{Math.max(...selectedForCompare)}
          </Button>
        )}
        {selectedForCompare.length === 1 && (
          <p className="text-xs text-muted-foreground">Select one more version to compare</p>
        )}
      </div>
    )}
  </DialogContent>
</Dialog>
```

Also add state for the checkbox selection:

```typescript
const [selectedForCompare, setSelectedForCompare] = useState<number[]>([])
```

And add `cn` import if not already present:
```typescript
import { cn } from "@/lib/utils"
```

- [ ] **Step 4: Verify the compare flow works**

Run: `npm run dev`
1. Open a composition that has multiple versions
2. Click History
3. Check two versions
4. Click Compare
5. Verify side-by-side diff appears

- [ ] **Step 5: Commit**

```bash
git add components/compositions/composition-editor.tsx
git commit -m "feat: add version comparison with side-by-side diff in history dialog"
```

---

### Task 7: Soft Approval Gate for Prod Deploy

**Files:**
- Modify: `components/compositions/composition-editor.tsx`

- [ ] **Step 1: Add prod confirmation state**

Add new state after the deploy state:

```typescript
const [prodConfirmOpen, setProdConfirmOpen] = useState(false)
const [prodDiff, setProdDiff] = useState<Array<{ type: "added" | "removed" | "unchanged"; text: string }> | null>(null)
const [loadingProdDiff, setLoadingProdDiff] = useState(false)
const [prodDeployVersion, setProdDeployVersion] = useState<number | null>(null)
```

- [ ] **Step 2: Add function to prepare prod deploy**

Add this function after the existing `deploy` function:

```typescript
async function prepareProdDeploy() {
  setDeployOpen(false)
  setProdConfirmOpen(true)
  setLoadingProdDiff(true)
  setProdDiff(null)

  try {
    // Get current prod deployment version
    const versionsRes = await fetch(`/api/compositions/${id}/versions`)
    const versions = await versionsRes.json()

    // Find the current prod deployment by checking deployments
    // For simplicity, assemble current graph vs what's about to be deployed
    // The "current" is the latest version, "new" is what we're deploying
    const currentRes = await fetch(`/api/compositions/${id}/assemble`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ graph: graphRef.current }),
    }).then((r) => r.json())

    // If there are previous versions, diff against the last one
    if (versions.length > 0) {
      const prevVersion = versions[0]
      const prevRes = await fetch(`/api/compositions/${id}/assemble`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph: prevVersion.graph }),
      }).then((r) => r.json())

      setProdDiff(diffLines(prevRes.text, currentRes.text))
    }
  } catch {}
  setLoadingProdDiff(false)
}
```

- [ ] **Step 3: Add review request function**

```typescript
async function requestReview() {
  await fetch(`/api/compositions/${id}/promote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ environment: "prod", reviewOnly: true }),
  })
  toast.success("Review requested — visible in the audit log")
}
```

Wait — we shouldn't use the promote endpoint for review requests. Instead, use the audit log directly. But there's no standalone audit API from the client. Simplest approach: add a `POST /api/audit` endpoint, or just include the review request as metadata in the deploy flow. Actually, the cleanest approach: just call the existing promote endpoint but add audit logging for the review action separately. Let me simplify — the review request is just an audit log entry. We can add a small API route:

Actually, let's keep it even simpler. The "Request Review" button just shows a toast and writes to a new simple endpoint. But to avoid over-engineering, let's just record it as part of the deploy flow. The user clicks "Request Review", it logs an audit entry via a fetch call:

```typescript
async function requestReview() {
  try {
    await fetch("/api/audit-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "deployment.review_requested",
        resourceType: "composition",
        resourceId: id,
        metadata: { version, environment: "prod" },
      }),
    })
  } catch {}
  toast.success("Review requested — visible in the audit log")
}
```

We'll need a small audit log POST endpoint. Let me add it to the task.

- [ ] **Step 4: Create audit log POST endpoint**

```typescript
// app/api/audit-log/route.ts
import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"

export async function POST(req: Request) {
  const { orgId, userId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { action, resourceType, resourceId, metadata } = await req.json()

  await logAudit({ teamId: orgId, userId, action, resourceType, resourceId, metadata })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Update deploy dialog — intercept prod**

In the deploy dialog JSX, update the prod button to call `prepareProdDeploy()` instead of `deploy("prod")`:

Replace the deploy dialog with:

```tsx
<Dialog open={deployOpen} onOpenChange={setDeployOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Deploy Composition</DialogTitle>
    </DialogHeader>
    <p className="text-sm text-muted-foreground">
      Deploy <span className="font-medium text-foreground">{name}</span> v{version} to
      an environment.
    </p>
    <div className="flex flex-col gap-2">
      {(["dev", "staging"] as const).map((env) => (
        <Button
          key={env}
          variant="outline"
          className="justify-start gap-2"
          disabled={deploying}
          onClick={() => deploy(env)}
        >
          <span className={`h-2 w-2 rounded-full ${env === "staging" ? "bg-yellow-500" : "bg-green-500"}`} />
          {env}
        </Button>
      ))}
      <Button
        variant="outline"
        className="justify-start gap-2"
        disabled={deploying}
        onClick={prepareProdDeploy}
      >
        <span className="h-2 w-2 rounded-full bg-red-500" />
        prod
      </Button>
    </div>
  </DialogContent>
</Dialog>

{/* Prod Confirmation Dialog */}
<Dialog open={prodConfirmOpen} onOpenChange={setProdConfirmOpen}>
  <DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle>Deploy to Production</DialogTitle>
    </DialogHeader>

    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
      <span className="text-sm text-amber-500">This will affect live traffic immediately</span>
    </div>

    {loadingProdDiff ? (
      <p className="text-sm text-muted-foreground">Loading changes...</p>
    ) : prodDiff && prodDiff.length > 0 ? (
      <div>
        <p className="text-xs text-muted-foreground mb-2">Changes from previous version:</p>
        <VersionDiff
          diff={prodDiff}
          leftLabel="Previous"
          rightLabel={`v${version} (deploying)`}
        />
      </div>
    ) : (
      <p className="text-xs text-muted-foreground">No previous version to compare against.</p>
    )}

    <div className="flex items-center justify-between pt-2">
      <Button
        size="sm"
        variant="outline"
        onClick={requestReview}
      >
        Request Review
      </Button>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setProdConfirmOpen(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={deploying}
          onClick={async () => {
            await deploy("prod")
            setProdConfirmOpen(false)
          }}
        >
          Deploy to prod
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

Add `AlertTriangle` to the lucide-react import if not already there.

- [ ] **Step 6: Commit**

```bash
git add components/compositions/composition-editor.tsx app/api/audit-log/route.ts
git commit -m "feat: add soft approval gate with diff preview for prod deploys"
```

---

### Task 8: Quick Fixes (Pre-existing Issues)

**Files:**
- Modify: `components/charts/line-chart-card.tsx` (fix build error)
- Create or modify: `.env.example` (document ENCRYPTION_KEY)

- [ ] **Step 1: Fix the pre-existing build type error**

Read `components/charts/line-chart-card.tsx`. Find the `formatter` prop on the tooltip around line 23. The issue is the parameter type — `value` is typed as `number` but recharts passes `ValueType | undefined`. Fix by typing the parameter correctly:

Change `(value: number)` to `(value: any)` in the formatter callback.

- [ ] **Step 2: Add ENCRYPTION_KEY to .env.example**

Read `.env.example` or `.env.local` to see what vars exist. Create `.env.example` if it doesn't exist, or add to it:

```
ENCRYPTION_KEY=your-64-char-hex-string-here
```

Add a comment explaining it:
```
# 32-byte hex key for encrypting provider API keys. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=
```

- [ ] **Step 3: Add .superpowers/ to .gitignore**

Check if `.gitignore` exists and if `.superpowers/` is already in it. If not, add it.

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds (or at least the line-chart error is gone)

- [ ] **Step 5: Commit**

```bash
git add components/charts/line-chart-card.tsx .env.example .gitignore
git commit -m "fix: resolve build error and add env documentation"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS (including new diff tests)

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Manual verification**

1. Blocks page → edit a block → verify "Used in" section shows compositions with env badges
2. Blocks page → edit a block used in prod → verify amber warning appears
3. Composition editor → History → check 2 versions → Compare → verify side-by-side diff
4. Composition editor → Deploy → click prod → verify confirmation dialog with diff + warning
5. Click "Request Review" → verify toast appears
6. Click "Deploy to prod" → verify deployment succeeds

- [ ] **Step 4: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: batch 2 integration fixes"
```
