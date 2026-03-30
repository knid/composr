"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { BlockCard } from "./block-card"
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
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Block
            </Button>
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
          <BlockCard key={block.id} block={block} onClick={() => {}} />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            {search ? "No blocks match your search." : "No blocks yet. Create your first one."}
          </p>
        )}
      </div>
    </div>
  )
}
