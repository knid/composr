"use client"

import "@xyflow/react/dist/style.css"

import { useEffect, useState, useCallback } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
} from "@xyflow/react"
import { GitBranch, Workflow } from "lucide-react"

interface Composition {
  id: string
  name: string
  version: number
  graph: { nodes: { type?: string }[]; edges: unknown[] }
}

function CompositionNode({ data }: { data: { label: string; version: number; blockCount: number } }) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 min-w-[160px]">
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="h-3.5 w-3.5 text-primary/60" />
        <span className="text-xs font-semibold text-foreground">{data.label}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="font-mono">v{data.version}</span>
        <span>·</span>
        <span>{data.blockCount} blocks</span>
      </div>
    </div>
  )
}

const nodeTypes = { compositionNode: CompositionNode }

const COLS = 4
const H_GAP = 220
const V_GAP = 120

export default function PipelinesPage() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCompositions = useCallback(async () => {
    try {
      const res = await fetch("/api/compositions")
      if (!res.ok) return
      const data: Composition[] = await res.json()
      const built: Node[] = data.map((comp, i) => {
        const col = i % COLS
        const row = Math.floor(i / COLS)
        const blockCount = comp.graph?.nodes?.filter(
          (n) => n.type === "block"
        ).length ?? 0
        return {
          id: comp.id,
          type: "compositionNode",
          position: { x: col * H_GAP + (row % 2 === 1 ? H_GAP / 2 : 0), y: row * V_GAP },
          data: { label: comp.name, version: comp.version, blockCount },
        }
      })
      setNodes(built)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCompositions()
  }, [fetchCompositions])

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex items-center gap-2 mb-4">
        <Workflow className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-lg font-semibold tracking-tight">Pipelines</h1>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center max-w-sm">
            <Workflow className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
            <div className="text-sm font-medium text-muted-foreground">No compositions yet</div>
            <div className="mt-1 text-[11px] text-muted-foreground/70">
              Create a composition to see it appear here as a pipeline node.
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 rounded-xl border border-border overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={[]}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls />
            <MiniMap zoomable pannable />
          </ReactFlow>
        </div>
      )}
    </div>
  )
}
