"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"

export function NewCompositionButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [folder, setFolder] = useState("")
  const [loading, setLoading] = useState(false)

  async function create() {
    setLoading(true)
    const res = await fetch("/api/compositions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, folder: folder || undefined }),
    })
    const composition = await res.json()
    setName("")
    setFolder("")
    setOpen(false)
    setLoading(false)
    router.push(`/compositions/${composition.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="h-3.5 w-3.5" /> New Composition
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Composition</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Composition name (e.g. builder, onboarding)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && create()}
        />
        <Input
          placeholder="Folder (optional, e.g. onboarding, checkout)"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        />
        <Button onClick={create} disabled={!name.trim() || loading}>
          {loading ? "Creating..." : "Create"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
