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
      {folders.length > 0 && (
        <div className="flex items-center gap-1 mb-3">
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
