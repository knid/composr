"use client"

import { Boxes } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface BlockCardProps {
  block: {
    id: string
    name: string
    description: string | null
    content: string
    version: number
    tags: string[]
    updatedAt: string
  }
  onClick: () => void
}

export function BlockCard({ block, onClick }: BlockCardProps) {
  const tokenEstimate = Math.round(block.content.length / 4)

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/30"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{block.name}</span>
        </div>
        <span className="font-mono text-xs text-muted-foreground">v{block.version}</span>
      </div>
      {block.description && (
        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1">{block.description}</p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{tokenEstimate} tokens</span>
        {(block.tags as string[]).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
            {tag}
          </Badge>
        ))}
      </div>
    </button>
  )
}
