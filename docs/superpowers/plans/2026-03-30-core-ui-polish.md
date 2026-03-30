# Core UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Monaco editor for blocks, Cmd+K command palette with shortcuts, tag filtering, version history UI, and rollback API.

**Architecture:** Six focused features, each touching a small set of files. Monaco wraps `@monaco-editor/react`. Command palette uses existing `cmdk`/shadcn. Version history adds 3 new API routes. All features are UI-layer and independent of each other.

**Tech Stack:** React, @monaco-editor/react, cmdk, shadcn/ui, Next.js API routes, Drizzle ORM

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `components/editor/monaco-block-editor.tsx` | Create | Reusable Monaco editor for block content |
| `components/blocks/block-list.tsx` | Modify | Replace Textarea with Monaco, add tag filter, add version history |
| `components/command-palette.tsx` | Create | Global Cmd+K command palette with Cmd+E/Cmd+P shortcuts |
| `app/(app)/layout.tsx` | Modify | Mount CommandPalette |
| `app/api/blocks/[id]/versions/route.ts` | Create | Block version history API |
| `app/api/compositions/[id]/versions/route.ts` | Create | Composition version history API |
| `app/api/compositions/[id]/rollback/route.ts` | Create | Rollback API |
| `components/compositions/composition-editor.tsx` | Modify | Add version history button and restore UI |

---

### Task 1: Monaco block editor component

**Files:**
- Create: `components/editor/monaco-block-editor.tsx`

- [ ] **Step 1: Create the MonacoBlockEditor component**

Create `components/editor/monaco-block-editor.tsx`:

```tsx
"use client"

import { useRef, useCallback } from "react"
import Editor, { type OnMount } from "@monaco-editor/react"

interface MonacoBlockEditorProps {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  height?: string
}

export function MonacoBlockEditor({
  value,
  onChange,
  readOnly = false,
  height = "200px",
}: MonacoBlockEditorProps) {
  const editorRef = useRef<any>(null)

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor

    // Define dark theme matching app aesthetic
    monaco.editor.defineTheme("composr-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "variable.template", foreground: "7c3aed", fontStyle: "bold" },
      ],
      colors: {
        "editor.background": "#0a0a0a",
        "editor.foreground": "#a1a1aa",
        "editor.lineHighlightBackground": "#18181b",
        "editor.selectionBackground": "#27272a",
        "editorCursor.foreground": "#7c3aed",
        "editorLineNumber.foreground": "#3f3f46",
        "editorLineNumber.activeForeground": "#71717a",
      },
    })
    monaco.editor.setTheme("composr-dark")

    // Register a simple language for prompt blocks
    if (!monaco.languages.getLanguages().some((l: any) => l.id === "promptblock")) {
      monaco.languages.register({ id: "promptblock" })
      monaco.languages.setMonarchTokensProvider("promptblock", {
        tokenizer: {
          root: [
            [/\{\{[^}]+\}\}/, "variable.template"],
          ],
        },
      })
    }

    editor.updateOptions({
      minimap: { enabled: false },
      lineNumbers: readOnly ? "off" : "on",
      scrollBeyondLastLine: false,
      wordWrap: "on",
      fontSize: 12,
      fontFamily: "var(--font-geist-mono), monospace",
      readOnly,
      renderLineHighlight: readOnly ? "none" : "line",
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      scrollbar: {
        vertical: "auto",
        horizontal: "hidden",
        verticalScrollbarSize: 6,
      },
      padding: { top: 8, bottom: 8 },
    })
  }, [readOnly])

  const handleChange = useCallback(
    (val: string | undefined) => {
      if (onChange && val !== undefined) onChange(val)
    },
    [onChange]
  )

  const tokenCount = Math.round(value.length / 4)

  return (
    <div>
      <div className="rounded-md border border-border overflow-hidden">
        <Editor
          height={height}
          language="promptblock"
          value={value}
          onChange={handleChange}
          onMount={handleMount}
          theme="composr-dark"
          options={{ readOnly }}
          loading={
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              Loading editor...
            </div>
          }
        />
      </div>
      {!readOnly && (
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="font-mono">{tokenCount} tokens</span>
          <span className="text-border">|</span>
          <span>{value.length} chars</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/knid/Projects/promptkit
git add components/editor/monaco-block-editor.tsx
git commit -m "feat: add MonacoBlockEditor component with variable highlighting"
```

---

### Task 2: Replace Textarea with Monaco in block edit dialog

**Files:**
- Modify: `components/blocks/block-list.tsx`

- [ ] **Step 1: Replace Textarea with MonacoBlockEditor**

In `components/blocks/block-list.tsx`:

Add the import at the top:
```typescript
import { MonacoBlockEditor } from "@/components/editor/monaco-block-editor"
```

Remove the `Textarea` import (it's only used for block content editing).

Find the Textarea in the edit dialog (around line 148):
```tsx
<Textarea
  value={editContent}
  onChange={(e) => setEditContent(e.target.value)}
  className="min-h-[200px] font-mono text-xs"
  placeholder="Block content (prompt text)..."
/>
```

Replace with:
```tsx
<MonacoBlockEditor
  value={editContent}
  onChange={(val) => setEditContent(val)}
  height="250px"
/>
```

- [ ] **Step 2: Commit**

```bash
cd /home/knid/Projects/promptkit
git add components/blocks/block-list.tsx
git commit -m "feat: use Monaco editor for block content editing"
```

---

### Task 3: Block tag filter UI

**Files:**
- Modify: `components/blocks/block-list.tsx`

- [ ] **Step 1: Add tag filter state and logic**

In `components/blocks/block-list.tsx`, add state for active tags after the existing `search` state:
```typescript
const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
```

Extract all unique tags from blocks (after the state declarations):
```typescript
const allTags = Array.from(new Set(blocks.flatMap((b) => b.tags ?? [])))
```

Update the `filtered` variable to include tag filtering:
```typescript
const filtered = blocks.filter((b) => {
  const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase())
  const matchesTags = activeTags.size === 0 || (b.tags ?? []).some((t) => activeTags.has(t))
  return matchesSearch && matchesTags
})
```

Add a toggle function:
```typescript
function toggleTag(tag: string) {
  setActiveTags((prev) => {
    const next = new Set(prev)
    if (next.has(tag)) next.delete(tag)
    else next.add(tag)
    return next
  })
}
```

- [ ] **Step 2: Render tag filter row**

Add a tag filter row between the search bar and the grid (after the closing `</div>` of the search bar flex container, before the grid `<div>`):

```tsx
{allTags.length > 0 && (
  <div className="flex flex-wrap gap-1.5 mb-4">
    {allTags.map((tag) => (
      <button
        key={tag}
        onClick={() => toggleTag(tag)}
        className={cn(
          "rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors",
          activeTags.has(tag)
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-muted-foreground hover:text-foreground"
        )}
      >
        {tag}
      </button>
    ))}
  </div>
)}
```

Add the `cn` import if not already present:
```typescript
import { cn } from "@/lib/utils"
```

- [ ] **Step 3: Commit**

```bash
cd /home/knid/Projects/promptkit
git add components/blocks/block-list.tsx
git commit -m "feat: add tag filter to blocks page"
```

---

### Task 4: Command palette with Cmd+K, Cmd+E, Cmd+P

**Files:**
- Create: `components/command-palette.tsx`
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Create the command palette component**

Create `components/command-palette.tsx`:

```tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  LayoutDashboard, GitBranch, Boxes, Settings, Beaker, Target,
  BarChart3, ScrollText, Workflow, Activity, Plus,
} from "lucide-react"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compositions", label: "Compositions", icon: GitBranch },
  { href: "/blocks", label: "Blocks", icon: Boxes },
  { href: "/pipelines", label: "Pipelines", icon: Workflow },
  { href: "/experiments", label: "Experiments", icon: Beaker },
  { href: "/scoring", label: "Scoring", icon: Target },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/usage", label: "Usage", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
]

interface Item {
  id: string
  name: string
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [initialFilter, setInitialFilter] = useState("")
  const [compositions, setCompositions] = useState<Item[]>([])
  const [blocks, setBlocks] = useState<Item[]>([])

  // Fetch data when opened
  useEffect(() => {
    if (!open) return
    fetch("/api/compositions").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setCompositions(data.map((c: any) => ({ id: c.id, name: c.name })))
    }).catch(() => {})
    fetch("/api/blocks").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setBlocks(data.map((b: any) => ({ id: b.id, name: b.name })))
    }).catch(() => {})
  }, [open])

  const openWith = useCallback((filter: string) => {
    setInitialFilter(filter)
    setOpen(true)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === "k") {
        e.preventDefault()
        openWith("")
      } else if (mod && e.key === "e") {
        e.preventDefault()
        openWith("block:")
      } else if (mod && e.key === "p") {
        e.preventDefault()
        openWith("comp:")
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [openWith])

  function select(href: string) {
    setOpen(false)
    setInitialFilter("")
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setInitialFilter("") }}>
      <CommandInput
        placeholder="Type a command or search..."
        defaultValue={initialFilter}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {navItems.map((item) => (
            <CommandItem key={item.href} onSelect={() => select(item.href)}>
              <item.icon className="mr-2 h-4 w-4 opacity-50" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Compositions">
          {compositions.map((comp) => (
            <CommandItem
              key={comp.id}
              value={`comp:${comp.name}`}
              onSelect={() => select(`/compositions/${comp.id}`)}
            >
              <GitBranch className="mr-2 h-4 w-4 opacity-50" />
              {comp.name}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Blocks">
          {blocks.map((block) => (
            <CommandItem
              key={block.id}
              value={`block:${block.name}`}
              onSelect={() => select("/blocks")}
            >
              <Boxes className="mr-2 h-4 w-4 opacity-50" />
              {block.name}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => select("/compositions")}>
            <Plus className="mr-2 h-4 w-4 opacity-50" />
            Create new composition
          </CommandItem>
          <CommandItem onSelect={() => select("/blocks")}>
            <Plus className="mr-2 h-4 w-4 opacity-50" />
            Create new block
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

- [ ] **Step 2: Mount in app layout**

In `app/(app)/layout.tsx`, add the import and render it:

```typescript
import { CommandPalette } from "@/components/command-palette"
```

Add `<CommandPalette />` inside the root div, after `<Sidebar />`:

```tsx
return (
  <div className="flex min-h-dvh">
    <Sidebar />
    <main className="flex-1 overflow-y-auto p-6">{children}</main>
    <CommandPalette />
  </div>
)
```

Note: `app/(app)/layout.tsx` is a server component. Since `CommandPalette` is a client component, this works fine — server components can render client components.

- [ ] **Step 3: Commit**

```bash
cd /home/knid/Projects/promptkit
git add components/command-palette.tsx "app/(app)/layout.tsx"
git commit -m "feat: add Cmd+K command palette with Cmd+E and Cmd+P shortcuts"
```

---

### Task 5: Version history API routes

**Files:**
- Create: `app/api/blocks/[id]/versions/route.ts`
- Create: `app/api/compositions/[id]/versions/route.ts`
- Create: `app/api/compositions/[id]/rollback/route.ts`

- [ ] **Step 1: Create block versions API**

Create `app/api/blocks/[id]/versions/route.ts`:

```typescript
import { db } from "@/lib/db"
import { blockVersions, blocks } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and, desc } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  // Verify block belongs to this team
  const [block] = await db
    .select()
    .from(blocks)
    .where(and(eq(blocks.id, id), eq(blocks.teamId, orgId)))

  if (!block) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const versions = await db
    .select()
    .from(blockVersions)
    .where(eq(blockVersions.blockId, id))
    .orderBy(desc(blockVersions.version))

  return NextResponse.json(versions)
}
```

- [ ] **Step 2: Create composition versions API**

Create `app/api/compositions/[id]/versions/route.ts`:

```typescript
import { db } from "@/lib/db"
import { compositionVersions, compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and, desc } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  // Verify composition belongs to this team
  const [comp] = await db
    .select()
    .from(compositions)
    .where(and(eq(compositions.id, id), eq(compositions.teamId, orgId)))

  if (!comp) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const versions = await db
    .select()
    .from(compositionVersions)
    .where(eq(compositionVersions.compositionId, id))
    .orderBy(desc(compositionVersions.version))

  return NextResponse.json(versions)
}
```

- [ ] **Step 3: Create rollback API**

Create `app/api/compositions/[id]/rollback/route.ts`:

```typescript
import { db } from "@/lib/db"
import { compositions, compositionVersions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"
import { configEvents } from "@/lib/config-events"
import { invalidateTeam } from "@/lib/config-cache"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId, userId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const { version: targetVersion } = body

  if (typeof targetVersion !== "number") {
    return NextResponse.json({ error: "version (number) is required" }, { status: 400 })
  }

  // Verify composition belongs to this team
  const [comp] = await db
    .select()
    .from(compositions)
    .where(and(eq(compositions.id, id), eq(compositions.teamId, orgId)))

  if (!comp) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Find the target version
  const [targetVersionRow] = await db
    .select()
    .from(compositionVersions)
    .where(
      and(
        eq(compositionVersions.compositionId, id),
        eq(compositionVersions.version, targetVersion)
      )
    )

  if (!targetVersionRow) {
    return NextResponse.json({ error: `Version ${targetVersion} not found` }, { status: 404 })
  }

  const newVersion = comp.version + 1

  // Update composition with the historical version's data
  const [updated] = await db
    .update(compositions)
    .set({
      graph: targetVersionRow.graph,
      contextSchema: targetVersionRow.contextSchema,
      version: newVersion,
      updatedAt: new Date(),
    })
    .where(eq(compositions.id, id))
    .returning()

  // Create a new version entry for the rollback
  await db.insert(compositionVersions).values({
    compositionId: id,
    version: newVersion,
    graph: targetVersionRow.graph,
    contextSchema: targetVersionRow.contextSchema,
    createdBy: userId,
  })

  await logAudit({
    teamId: orgId,
    userId,
    action: "composition.rolledBack",
    resourceType: "composition",
    resourceId: id,
    metadata: { fromVersion: comp.version, toVersion: targetVersion, newVersion },
  })

  invalidateTeam(orgId)
  configEvents.notify(orgId)

  return NextResponse.json(updated)
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/knid/Projects/promptkit
git add app/api/blocks/[id]/versions/ app/api/compositions/[id]/versions/ app/api/compositions/[id]/rollback/
git commit -m "feat: add version history and rollback API routes"
```

---

### Task 6: Block version history UI

**Files:**
- Modify: `components/blocks/block-list.tsx`

- [ ] **Step 1: Add version history state and fetch**

In `components/blocks/block-list.tsx`, add state after existing edit state:

```typescript
const [versions, setVersions] = useState<Array<{ version: number; content: string; createdAt: string }>>([])
const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
const [loadingVersions, setLoadingVersions] = useState(false)
```

Update the `openEdit` function to also fetch versions:

```typescript
function openEdit(block: Block) {
  setEditBlock(block)
  setEditName(block.name)
  setEditDescription(block.description ?? "")
  setEditContent(block.content)
  setEditTags((block.tags ?? []).join(", "))
  setVersions([])
  setSelectedVersion(null)
  // Fetch version history
  setLoadingVersions(true)
  fetch(`/api/blocks/${block.id}/versions`)
    .then((r) => r.json())
    .then((data) => { if (Array.isArray(data)) setVersions(data) })
    .catch(() => {})
    .finally(() => setLoadingVersions(false))
}
```

- [ ] **Step 2: Add version history section in edit dialog**

In the edit dialog content, after the Tags input and before the action buttons, add:

```tsx
{versions.length > 0 && (
  <div>
    <label className="text-xs font-medium text-muted-foreground">
      Version History
    </label>
    <div className="flex items-center gap-2 mt-1">
      <select
        value={selectedVersion ?? ""}
        onChange={(e) => setSelectedVersion(e.target.value ? Number(e.target.value) : null)}
        className="rounded border border-border bg-background px-2 py-1.5 text-xs flex-1"
      >
        <option value="">Current (v{editBlock?.version})</option>
        {versions.map((v) => (
          <option key={v.version} value={v.version}>
            v{v.version} — {new Date(v.createdAt).toLocaleDateString()}
          </option>
        ))}
      </select>
      {selectedVersion !== null && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const v = versions.find((ver) => ver.version === selectedVersion)
            if (v) {
              setEditContent(v.content)
              setSelectedVersion(null)
              toast.success(`Restored content from v${v.version}`)
            }
          }}
        >
          Restore
        </Button>
      )}
    </div>
    {selectedVersion !== null && (
      <div className="mt-2">
        <MonacoBlockEditor
          value={versions.find((v) => v.version === selectedVersion)?.content ?? ""}
          readOnly
          height="150px"
        />
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
cd /home/knid/Projects/promptkit
git add components/blocks/block-list.tsx
git commit -m "feat: add version history UI to block edit dialog"
```

---

### Task 7: Composition version history UI

**Files:**
- Modify: `components/compositions/composition-editor.tsx`

- [ ] **Step 1: Add version history state and UI**

In `components/compositions/composition-editor.tsx`:

Add imports:
```typescript
import { History } from "lucide-react"
```

Add state after existing state declarations:
```typescript
const [historyOpen, setHistoryOpen] = useState(false)
const [compVersions, setCompVersions] = useState<Array<{ version: number; graph: any; contextSchema: any; createdAt: string }>>([])
const [loadingHistory, setLoadingHistory] = useState(false)
```

Add fetch function:
```typescript
async function fetchHistory() {
  setLoadingHistory(true)
  try {
    const res = await fetch(`/api/compositions/${id}/versions`)
    const data = await res.json()
    if (Array.isArray(data)) setCompVersions(data)
  } catch {}
  setLoadingHistory(false)
  setHistoryOpen(true)
}

async function rollbackTo(targetVersion: number) {
  const res = await fetch(`/api/compositions/${id}/rollback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: targetVersion }),
  })
  if (res.ok) {
    toast.success(`Rolled back to v${targetVersion}`)
    setHistoryOpen(false)
    router.refresh()
  } else {
    const data = await res.json()
    toast.error(data.error ?? "Rollback failed")
  }
}
```

- [ ] **Step 2: Add History button in toolbar**

In the toolbar, add a History button before the Deploy button:
```tsx
<Button
  size="sm"
  variant="outline"
  className="gap-1.5"
  onClick={fetchHistory}
>
  <History className="h-3.5 w-3.5" /> History
</Button>
```

- [ ] **Step 3: Add History dialog**

Add the dialog at the bottom, alongside the existing dialogs:

```tsx
<Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Version History</DialogTitle>
    </DialogHeader>
    {loadingHistory ? (
      <p className="text-sm text-muted-foreground">Loading...</p>
    ) : compVersions.length === 0 ? (
      <p className="text-sm text-muted-foreground">No version history available.</p>
    ) : (
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {compVersions.map((v) => {
          const nodeCount = v.graph?.nodes?.length ?? 0
          const blockCount = v.graph?.nodes?.filter((n: any) => n.type === "block").length ?? 0
          return (
            <div
              key={v.version}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
            >
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
              {v.version !== version && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rollbackTo(v.version)}
                >
                  Restore
                </Button>
              )}
            </div>
          )
        })}
      </div>
    )}
  </DialogContent>
</Dialog>
```

- [ ] **Step 4: Commit**

```bash
cd /home/knid/Projects/promptkit
git add components/compositions/composition-editor.tsx
git commit -m "feat: add version history and rollback UI to composition editor"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run all tests**

Run: `cd /home/knid/Projects/promptkit && npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: TypeScript check**

Run: `cd /home/knid/Projects/promptkit && npx tsc --noEmit 2>&1 | grep -v flow-canvas | head -20`
Expected: No new TypeScript errors (flow-canvas error is pre-existing)

- [ ] **Step 3: Commit any fixes**

If any fixes were needed:
```bash
git add -A
git commit -m "fix: address verification issues in core UI polish"
```
