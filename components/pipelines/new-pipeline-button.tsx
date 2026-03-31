"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export function NewPipelineButton() {
  const router = useRouter()

  async function create() {
    const res = await fetch("/api/pipelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Pipeline ${Date.now().toString(36).slice(-4)}` }),
    })
    if (res.ok) {
      const pipeline = await res.json()
      router.push(`/pipelines/${pipeline.id}`)
    }
  }

  return (
    <Button size="sm" className="gap-1.5" onClick={create}>
      <Plus className="h-3.5 w-3.5" /> New Pipeline
    </Button>
  )
}
