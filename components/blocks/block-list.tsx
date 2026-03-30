"use client"

import { useState } from "react"
import { Plus, Search, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
}

export function BlockList({ initialBlocks }: { initialBlocks: Block[] }) {
  const [blocks, setBlocks] = useState(initialBlocks)
  const [search, setSearch] = useState("")
  const [newName, setNewName] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  // Edit state
  const [editBlock, setEditBlock] = useState<Block | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editTags, setEditTags] = useState("")
  const [saving, setSaving] = useState(false)

  const filtered = blocks.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  async function createBlock() {
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, content: "" }),
    })
    const block = await res.json()
    setBlocks([block, ...blocks])
    setNewName("")
    setDialogOpen(false)
  }

  function openEdit(block: Block) {
    setEditBlock(block)
    setEditName(block.name)
    setEditDescription(block.description ?? "")
    setEditContent(block.content)
    setEditTags((block.tags ?? []).join(", "))
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
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search blocks..."
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
            <Button onClick={createBlock} disabled={!newName.trim()}>Create</Button>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((block) => (
          <BlockCard key={block.id} block={block} onClick={() => openEdit(block)} />
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
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[200px] font-mono text-xs"
                placeholder="Block content (prompt text)..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tags (comma-separated)</label>
              <Input value={editTags} onChange={(e) => setEditTags(e.target.value)}
                placeholder="e.g. system, persona, guardrail" />
            </div>
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
