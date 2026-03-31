# Batch 3: Scale & Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add generic webhooks for change notifications and improve search/organization so teams can manage 100+ blocks and compositions efficiently.

**Architecture:** Webhooks: new table + fire-and-forget delivery hooked into the existing audit system. Search: extend client-side filtering to cover description/content. Folders: surface the existing `folder` column on compositions with a filter dropdown.

**Tech Stack:** Next.js 16, React 19, Drizzle ORM, Vitest.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `lib/webhooks.ts` | `fireWebhooks()` — query matching webhooks, POST payloads, HMAC signing |
| `lib/webhooks.test.ts` | Tests for event matching and HMAC signing |
| `app/api/webhooks/route.ts` | List/create webhooks |
| `app/api/webhooks/[id]/route.ts` | Update/delete webhooks |
| `components/settings/webhooks.tsx` | Webhook management UI |
| `components/compositions/composition-list.tsx` | Client component with search + folder filter |

### Modified Files
| File | Changes |
|------|---------|
| `lib/schema.ts` | Add `webhooks` table |
| `lib/audit.ts` | Call `fireWebhooks()` after logging |
| `app/(app)/settings/page.tsx` | Add Webhooks section |
| `components/blocks/block-list.tsx` | Expand search to description + content |
| `app/(app)/compositions/page.tsx` | Extract card rendering to client component |
| `components/compositions/new-composition-button.tsx` | Add folder field |
| `app/api/compositions/route.ts` | Accept folder in POST |

---

### Task 1: Webhooks Schema

**Files:**
- Modify: `lib/schema.ts`

- [ ] **Step 1: Add webhooks table to schema**

Add to `lib/schema.ts` after the `providerKeys` table:

```typescript
// webhooks
export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  url: text("url").notNull(),
  events: jsonb("events").notNull().default([]),
  enabled: boolean("enabled").notNull().default(true),
  secret: text("secret"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
```

- [ ] **Step 2: Generate migration**

Run: `npx drizzle-kit generate`

- [ ] **Step 3: Commit**

```bash
git add lib/schema.ts drizzle/
git commit -m "feat: add webhooks table"
```

---

### Task 2: Webhook Delivery Utility

**Files:**
- Create: `lib/webhooks.ts`
- Create: `lib/webhooks.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/webhooks.test.ts
import { describe, it, expect } from "vitest"
import { matchesEvent, signPayload } from "./webhooks"

describe("matchesEvent", () => {
  it("returns true when event is in the list", () => {
    expect(matchesEvent(["block.created", "block.updated"], "block.created")).toBe(true)
  })

  it("returns false when event is not in the list", () => {
    expect(matchesEvent(["block.created"], "deployment.promoted")).toBe(false)
  })

  it("returns false for empty events list", () => {
    expect(matchesEvent([], "block.created")).toBe(false)
  })
})

describe("signPayload", () => {
  it("produces a consistent HMAC-SHA256 signature", () => {
    const body = '{"event":"test"}'
    const secret = "my-secret"
    const sig1 = signPayload(body, secret)
    const sig2 = signPayload(body, secret)
    expect(sig1).toBe(sig2)
    expect(sig1).toMatch(/^[a-f0-9]{64}$/)
  })

  it("produces different signatures for different secrets", () => {
    const body = '{"event":"test"}'
    expect(signPayload(body, "secret-a")).not.toBe(signPayload(body, "secret-b"))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/webhooks.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// lib/webhooks.ts
import { createHmac } from "crypto"
import { db } from "@/lib/db"
import { webhooks } from "@/lib/schema"
import { eq } from "drizzle-orm"

export function matchesEvent(events: string[], event: string): boolean {
  return events.includes(event)
}

export function signPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex")
}

interface WebhookPayload {
  event: string
  timestamp: string
  teamId: string
  resource: {
    type: string
    id?: string
    metadata?: Record<string, any>
  }
}

export async function fireWebhooks(
  teamId: string,
  event: string,
  resource: { type: string; id?: string; metadata?: Record<string, any> }
) {
  try {
    const teamWebhooks = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.teamId, teamId))

    const matching = teamWebhooks.filter(
      (w) => w.enabled && matchesEvent(w.events as string[], event)
    )

    if (matching.length === 0) return

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      teamId,
      resource,
    }

    const body = JSON.stringify(payload)

    for (const webhook of matching) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (webhook.secret) {
        headers["X-Composr-Signature"] = signPayload(body, webhook.secret)
      }

      fetch(webhook.url, {
        method: "POST",
        headers,
        body,
      }).catch((err) => {
        console.error(`Webhook delivery failed for ${webhook.url}:`, err)
      })
    }
  } catch (err) {
    console.error("Webhook fire failed:", err)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/webhooks.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/webhooks.ts lib/webhooks.test.ts
git commit -m "feat: add webhook delivery utility with HMAC signing"
```

---

### Task 3: Hook Webhooks into Audit System

**Files:**
- Modify: `lib/audit.ts`

- [ ] **Step 1: Update logAudit to fire webhooks**

Read `lib/audit.ts`. Add the import and webhook call:

```typescript
import { fireWebhooks } from "@/lib/webhooks"
```

At the end of the `logAudit` function, after the db insert (but still inside the try block), add:

```typescript
// Fire matching webhooks (async, non-blocking)
void fireWebhooks(entry.teamId, entry.action, {
  type: entry.resourceType,
  id: entry.resourceId,
  metadata: entry.metadata,
})
```

The `void` keyword makes it fire-and-forget — it doesn't await the result, so webhook delivery never blocks the main flow.

- [ ] **Step 2: Commit**

```bash
git add lib/audit.ts
git commit -m "feat: fire webhooks on audit events"
```

---

### Task 4: Webhooks API Routes

**Files:**
- Create: `app/api/webhooks/route.ts`
- Create: `app/api/webhooks/[id]/route.ts`

- [ ] **Step 1: Create list/create route**

```typescript
// app/api/webhooks/route.ts
import { db } from "@/lib/db"
import { webhooks } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const teamWebhooks = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.teamId, orgId))

  return NextResponse.json(teamWebhooks)
}

export async function POST(req: Request) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { url, events, secret } = await req.json()

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 })
  }

  const [webhook] = await db.insert(webhooks).values({
    teamId: orgId,
    url,
    events: events ?? [],
    secret: secret || null,
  }).returning()

  return NextResponse.json(webhook, { status: 201 })
}
```

- [ ] **Step 2: Create update/delete route**

```typescript
// app/api/webhooks/[id]/route.ts
import { db } from "@/lib/db"
import { webhooks } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const { url, events, enabled, secret } = body

  const [existing] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.teamId, orgId)))

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [updated] = await db
    .update(webhooks)
    .set({
      url: url ?? existing.url,
      events: events ?? existing.events,
      enabled: enabled !== undefined ? enabled : existing.enabled,
      secret: secret !== undefined ? secret : existing.secret,
    })
    .where(eq(webhooks.id, id))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  await db.delete(webhooks).where(
    and(eq(webhooks.id, id), eq(webhooks.teamId, orgId))
  )

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/webhooks/
git commit -m "feat: add webhooks CRUD API routes"
```

---

### Task 5: Webhooks UI

**Files:**
- Create: `components/settings/webhooks.tsx`
- Modify: `app/(app)/settings/page.tsx`

- [ ] **Step 1: Create the webhooks component**

```tsx
// components/settings/webhooks.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Globe } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

interface Webhook {
  id: string
  url: string
  events: string[]
  enabled: boolean
  secret: string | null
  createdAt: string
}

const ALL_EVENTS = [
  "block.created",
  "block.updated",
  "block.deleted",
  "composition.updated",
  "deployment.promoted",
  "deployment.review_requested",
]

export function WebhooksSection() {
  const [hooks, setHooks] = useState<Webhook[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [secret, setSecret] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch("/api/webhooks")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setHooks(data) })
  }, [])

  async function addWebhook() {
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        events: Array.from(selectedEvents),
        secret: secret || undefined,
      }),
    })
    if (res.ok) {
      const hook = await res.json()
      setHooks([...hooks, hook])
      setAddOpen(false)
      setUrl("")
      setSecret("")
      setSelectedEvents(new Set())
      toast.success("Webhook added")
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    const res = await fetch(`/api/webhooks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
    if (res.ok) {
      setHooks(hooks.map((h) => h.id === id ? { ...h, enabled } : h))
    }
  }

  async function deleteWebhook(id: string) {
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" })
    setHooks(hooks.filter((h) => h.id !== id))
    toast.success("Webhook deleted")
  }

  function toggleEvent(event: string) {
    setSelectedEvents((prev) => {
      const next = new Set(prev)
      if (next.has(event)) next.delete(event)
      else next.add(event)
      return next
    })
  }

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold mb-3">Webhooks</h2>
      <p className="text-xs text-muted-foreground mb-3">
        Get notified when events happen. POST requests are sent to your URL with event details.
      </p>

      <div className="space-y-2 mb-4">
        {hooks.map((h) => (
          <div key={h.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
            <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{h.url}</div>
              <div className="flex gap-1 mt-0.5 flex-wrap">
                {(h.events as string[]).map((e) => (
                  <span key={e} className="rounded bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
                    {e}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => toggleEnabled(h.id, !h.enabled)}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                h.enabled
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {h.enabled ? "Active" : "Paused"}
            </button>
            <Button
              size="sm" variant="ghost"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => deleteWebhook(h.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Add Webhook
      </Button>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">URL</label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Events</label>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {ALL_EVENTS.map((event) => (
                  <label key={event} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEvents.has(event)}
                      onChange={() => toggleEvent(event)}
                      className="rounded"
                    />
                    {event}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Secret (optional)</label>
              <Input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="HMAC signing secret"
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                If set, requests include an X-Composr-Signature header for verification.
              </p>
            </div>
            <Button onClick={addWebhook} disabled={!url.trim() || selectedEvents.size === 0} className="w-full">
              Add Webhook
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
```

- [ ] **Step 2: Add WebhooksSection to settings page**

In `app/(app)/settings/page.tsx`, add the import:
```typescript
import { WebhooksSection } from "@/components/settings/webhooks"
```

Add `<WebhooksSection />` after the `<ProviderKeysSection />`.

- [ ] **Step 3: Commit**

```bash
git add components/settings/webhooks.tsx app/(app)/settings/page.tsx
git commit -m "feat: add webhook management UI to settings"
```

---

### Task 6: Improved Block Search

**Files:**
- Modify: `components/blocks/block-list.tsx`

- [ ] **Step 1: Update the search filter**

Read `components/blocks/block-list.tsx`. Find the `filtered` variable (around line 49). Replace the `matchesSearch` line:

From:
```typescript
const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase())
```

To:
```typescript
const matchesSearch = !search || [b.name, b.description, b.content]
  .filter(Boolean)
  .some(field => field!.toLowerCase().includes(search.toLowerCase()))
```

Also update the search input placeholder from `"Search blocks..."` to `"Search blocks by name, description, or content..."`.

- [ ] **Step 2: Commit**

```bash
git add components/blocks/block-list.tsx
git commit -m "feat: expand block search to cover description and content"
```

---

### Task 7: Composition List with Folder Filter

**Files:**
- Create: `components/compositions/composition-list.tsx`
- Modify: `app/(app)/compositions/page.tsx`
- Modify: `components/compositions/new-composition-button.tsx`
- Modify: `app/api/compositions/route.ts`

- [ ] **Step 1: Create the composition list client component**

```tsx
// components/compositions/composition-list.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { GitBranch, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

interface CompositionItem {
  id: string
  name: string
  description: string | null
  folder: string | null
  version: number
  graph: { nodes: any[]; edges: any[] }
  avgScore: number | null
  throughput: number
}

export function CompositionList({ compositions }: { compositions: CompositionItem[] }) {
  const [search, setSearch] = useState("")
  const [folderFilter, setFolderFilter] = useState<string | null>(null)

  const folders = Array.from(new Set(
    compositions.map((c) => c.folder).filter(Boolean) as string[]
  )).sort()

  const filtered = compositions.filter((c) => {
    const matchesSearch = !search || [c.name, c.description]
      .filter(Boolean)
      .some(field => field!.toLowerCase().includes(search.toLowerCase()))
    const matchesFolder = !folderFilter || c.folder === folderFilter
    return matchesSearch && matchesFolder
  })

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {folders.length > 0 && (
          <div className="flex gap-1">
            <button
              onClick={() => setFolderFilter(null)}
              className={cn(
                "px-2.5 py-1 text-[10px] font-medium rounded transition-colors",
                !folderFilter
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            {folders.map((f) => (
              <button
                key={f}
                onClick={() => setFolderFilter(f === folderFilter ? null : f)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-medium rounded transition-colors",
                  folderFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search compositions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((comp) => {
          const blockCount = comp.graph.nodes.filter((n: any) => n.type === "block").length
          const ifCount = comp.graph.nodes.filter((n: any) => n.type?.startsWith("if")).length
          return (
            <Link key={comp.id} href={`/compositions/${comp.id}`}
              className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{comp.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {comp.folder && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
                      {comp.folder}
                    </span>
                  )}
                  <Badge variant="secondary" className="text-[10px]">v{comp.version}</Badge>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {blockCount} blocks · {ifCount} IF nodes
                {comp.avgScore !== null && <> · <span className="text-success">{comp.avgScore}/100</span></>}
                {comp.throughput > 0 && <> · {comp.throughput}/24h</>}
              </p>
            </Link>
          )
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            {search || folderFilter ? "No compositions match your filters." : "No compositions yet. Create your first one."}
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update the compositions page to use the client component**

Replace the entire content of `app/(app)/compositions/page.tsx` with:

```tsx
import { db } from "@/lib/db"
import { compositions, scores, assemblyLogs } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc, gte, and, isNotNull } from "drizzle-orm"
import { redirect } from "next/navigation"
import { NewCompositionButton } from "@/components/compositions/new-composition-button"
import { CompositionList } from "@/components/compositions/composition-list"

export const dynamic = "force-dynamic"

export default async function CompositionsPage() {
  const { orgId } = await auth()
  if (!orgId) redirect("/")

  const comps = await db
    .select()
    .from(compositions)
    .where(eq(compositions.teamId, orgId))
    .orderBy(desc(compositions.updatedAt))

  const allScores = await db
    .select()
    .from(scores)
    .where(and(eq(scores.teamId, orgId), isNotNull(scores.overallScore)))

  const scoreByComp = new Map<string, number[]>()
  for (const s of allScores) {
    if (s.overallScore === null) continue
    const arr = scoreByComp.get(s.compositionId) ?? []
    arr.push(s.overallScore)
    scoreByComp.set(s.compositionId, arr)
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentAssemblies = await db
    .select()
    .from(assemblyLogs)
    .where(and(eq(assemblyLogs.teamId, orgId), gte(assemblyLogs.assembledAt, oneDayAgo)))

  const throughputByComp = new Map<string, number>()
  for (const a of recentAssemblies) {
    throughputByComp.set(a.compositionId, (throughputByComp.get(a.compositionId) ?? 0) + 1)
  }

  const compositionItems = comps.map((comp) => ({
    id: comp.id,
    name: comp.name,
    description: comp.description,
    folder: comp.folder,
    version: comp.version,
    graph: comp.graph as { nodes: any[]; edges: any[] },
    avgScore: (() => {
      const arr = scoreByComp.get(comp.id)
      return arr && arr.length > 0
        ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
        : null
    })(),
    throughput: throughputByComp.get(comp.id) ?? 0,
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold tracking-tight">Compositions</h1>
        <NewCompositionButton />
      </div>
      <CompositionList compositions={compositionItems} />
    </div>
  )
}
```

- [ ] **Step 3: Add folder field to NewCompositionButton**

Read `components/compositions/new-composition-button.tsx`. Add a folder input after the name input:

Add state:
```typescript
const [folder, setFolder] = useState("")
```

Update the `create` function to include folder:
```typescript
body: JSON.stringify({ name, folder: folder || undefined }),
```

Reset folder after creation:
```typescript
setFolder("")
```

Add folder input in the dialog, after the name `<Input>`:
```tsx
<Input
  placeholder="Folder (optional, e.g. onboarding, checkout)"
  value={folder}
  onChange={(e) => setFolder(e.target.value)}
/>
```

- [ ] **Step 4: Accept folder in compositions POST API**

Read `app/api/compositions/route.ts`. Add `folder` to the destructured body and include it in the insert values:

```typescript
const { name, folder } = body
// In .values():
folder: folder ?? null,
```

- [ ] **Step 5: Commit**

```bash
git add components/compositions/composition-list.tsx app/(app)/compositions/page.tsx components/compositions/new-composition-button.tsx app/api/compositions/route.ts
git commit -m "feat: add composition folder filter, search, and folder field"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Manual verification**

1. Settings → Webhooks → Add webhook with URL + events → verify it appears in list
2. Toggle webhook enabled/disabled → verify state changes
3. Delete webhook → verify removed
4. Blocks → search by content text → verify results include matching blocks
5. Compositions → verify folder filter tabs appear when compositions have folders
6. New Composition → verify folder field exists
7. Compositions → search by description → verify results filter

- [ ] **Step 4: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: batch 3 integration fixes"
```
