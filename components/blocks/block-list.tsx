"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { AlertTriangle, Plus, Search, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MonacoBlockEditor } from "@/components/editor/monaco-block-editor"
import { BlockCard } from "./block-card"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"

interface Block {
  id: string
  name: string
  description: string | null
  content: string
  version: number
  tags: string[]
  updatedAt: string
  kind?: string
}

export function BlockList({ initialBlocks, usageMap }: { initialBlocks: Block[]; usageMap: Record<string, string[]> }) {
  const [blocks, setBlocks] = useState(initialBlocks)
  const [search, setSearch] = useState("")
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [newName, setNewName] = useState("")
  const [newKind, setNewKind] = useState("prompt")
  const [kindFilter, setKindFilter] = useState<"all" | "prompt" | "tool">("all")
  const [dialogOpen, setDialogOpen] = useState(false)

  // Edit state
  const [editBlock, setEditBlock] = useState<Block | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editTags, setEditTags] = useState("")
  const [saving, setSaving] = useState(false)

  const [versions, setVersions] = useState<Array<{ version: number; content: string; createdAt: string }>>([])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [loadingVersions, setLoadingVersions] = useState(false)

  const [blockUsage, setBlockUsage] = useState<Array<{ compositionId: string; compositionName: string; nodeCount: number; environments: string[] }>>([])
  const [loadingUsage, setLoadingUsage] = useState(false)

  const allTags = Array.from(new Set(blocks.flatMap((b) => b.tags ?? [])))

  const filtered = blocks.filter((b) => {
    const matchesSearch = !search || [b.name, b.description, b.content]
      .filter(Boolean)
      .some(field => field!.toLowerCase().includes(search.toLowerCase()))
    const matchesTags = activeTags.size === 0 || (b.tags ?? []).some((t) => activeTags.has(t))
    const matchesKind = kindFilter === "all" || (b.kind ?? "prompt") === kindFilter
    return matchesSearch && matchesTags && matchesKind
  })

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  async function createBlock() {
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, content: "", kind: newKind }),
    })
    const block = await res.json()
    setBlocks([block, ...blocks])
    setNewName("")
    setNewKind("prompt")
    setDialogOpen(false)
  }

  function openEdit(block: Block) {
    setEditBlock(block)
    setEditName(block.name)
    setEditDescription(block.description ?? "")
    setEditContent(block.content)
    setEditTags((block.tags ?? []).join(", "))
    setVersions([])
    setSelectedVersion(null)
    setLoadingVersions(true)
    fetch(`/api/blocks/${block.id}/versions`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setVersions(data) })
      .catch(() => {})
      .finally(() => setLoadingVersions(false))
    setBlockUsage([])
    setLoadingUsage(true)
    fetch(`/api/blocks/${block.id}/usage`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setBlockUsage(data) })
      .catch(() => {})
      .finally(() => setLoadingUsage(false))
  }

  async function saveBlock() {
    if (!editBlock) return
    setSaving(true)
    const tags = editTags.split(",").map((t) => t.trim()).filter(Boolean)
    const res = await fetch(`/api/blocks/${editBlock.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDescription, content: editContent, tags }),
    })
    const updated = await res.json()
    setBlocks(blocks.map((b) => (b.id === editBlock.id ? { ...updated, tags: updated.tags ?? [] } : b)))
    setEditBlock(null)
    setSaving(false)
    toast.success("Block saved")
  }

  async function deleteBlock() {
    if (!editBlock) return
    const res = await fetch(`/api/blocks/${editBlock.id}`, { method: "DELETE" })
    if (res.ok) {
      setBlocks(blocks.filter((b) => b.id !== editBlock.id))
      setEditBlock(null)
      toast.success("Block deleted")
    }
  }

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {(["all", "prompt", "tool"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKindFilter(k)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-colors",
              kindFilter === k
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {k === "all" ? "All" : k === "tool" ? "Tools" : "Prompts"}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, description, or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
            <Plus className="h-3.5 w-3.5" /> New Block
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Block</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Block name (e.g. role, design-philosophy)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newName.trim() && createBlock()}
            />
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm mt-1"
              >
                <option value="prompt">Prompt Block</option>
                <option value="tool">Tool Definition</option>
              </select>
            </div>
            <Button onClick={createBlock} disabled={!newName.trim()}>Create</Button>
          </DialogContent>
        </Dialog>
      </div>
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((block) => (
          <BlockCard key={block.id} block={block} onClick={() => openEdit(block)} usedIn={usageMap[block.id] ?? []} />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            {search ? "No blocks match your search." : "No blocks yet. Create your first one."}
          </p>
        )}
      </div>

      {/* Edit Block Dialog */}
      <Dialog open={!!editBlock} onOpenChange={(open) => { if (!open) setEditBlock(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Block</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Content</label>
              <MonacoBlockEditor
                value={editContent}
                onChange={(val) => setEditContent(val)}
                height="250px"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tags (comma-separated)</label>
              <Input value={editTags} onChange={(e) => setEditTags(e.target.value)}
                placeholder="e.g. system, persona, guardrail" />
            </div>
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
            <div className="flex items-center justify-between pt-2">
              <Button variant="destructive" size="sm" className="gap-1.5" onClick={deleteBlock}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditBlock(null)}>Cancel</Button>
                <Button size="sm" onClick={saveBlock} disabled={saving || !editName.trim()}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
