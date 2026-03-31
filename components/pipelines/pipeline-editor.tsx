"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Button } from "@/components/ui/button"
import { Save, Trash2, Plus, GitBranch } from "lucide-react"
import { toast } from "sonner"

interface CompositionInfo {
  id: string
  name: string
  version: number
  blockCount: number
}

interface PipelineEditorProps {
  id: string
  name: string
  initialNodes: Node[]
  initialEdges: Edge[]
  compositions: CompositionInfo[]
}

function CompositionNode({ data }: { data: { label: string; version: number; blockCount: number; compositionId?: string } }) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 min-w-[180px] relative">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-primary/60 !border-primary/30"
      />
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="h-3.5 w-3.5 text-primary/60" />
        <span className="text-xs font-semibold text-foreground">{data.label}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="font-mono">v{data.version}</span>
        <span>·</span>
        <span>{data.blockCount} blocks</span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-primary/60 !border-primary/30"
      />
    </div>
  )
}

function PipelineStartNode() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-success bg-success/10">
      <span className="text-[9px] font-bold text-success">IN</span>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-success !border-success/50"
      />
    </div>
  )
}

function PipelineEndNode() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-destructive bg-destructive/10">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-destructive !border-destructive/50"
      />
      <span className="text-[9px] font-bold text-destructive">OUT</span>
    </div>
  )
}

const nodeTypes = {
  compositionNode: CompositionNode,
  pipelineStart: PipelineStartNode,
  pipelineEnd: PipelineEndNode,
}

function PipelineEditorInner({
  id,
  name,
  initialNodes,
  initialEdges,
  compositions,
}: PipelineEditorProps) {
  const router = useRouter()
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  // Ensure start/end nodes exist
  useEffect(() => {
    const hasStart = nodes.some((n) => n.type === "pipelineStart")
    const hasEnd = nodes.some((n) => n.type === "pipelineEnd")
    if (!hasStart || !hasEnd) {
      const newNodes: Node[] = []
      if (!hasStart) {
        newNodes.push({
          id: "pipeline-start",
          type: "pipelineStart",
          position: { x: 50, y: 200 },
          data: {},
          deletable: false,
        })
      }
      if (!hasEnd) {
        newNodes.push({
          id: "pipeline-end",
          type: "pipelineEnd",
          position: { x: 800, y: 200 },
          data: {},
          deletable: false,
        })
      }
      if (newNodes.length > 0) {
        setNodes((nds) => [...nds, ...newNodes])
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds))
      setDirty(true)
    },
    [setEdges]
  )

  function addComposition(comp: CompositionInfo) {
    const newNode: Node = {
      id: `comp-${comp.id}-${Date.now()}`,
      type: "compositionNode",
      position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: { label: comp.name, version: comp.version, blockCount: comp.blockCount, compositionId: comp.id },
    }
    setNodes((nds) => [...nds, newNode])
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/pipelines/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ graph: { nodes, edges } }),
    })
    if (res.ok) {
      setDirty(false)
      toast.success("Pipeline saved")
    } else {
      toast.error("Failed to save")
    }
    setSaving(false)
  }

  async function deletePipeline() {
    if (!confirm("Delete this pipeline?")) return
    const res = await fetch(`/api/pipelines/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("Pipeline deleted")
      router.push("/pipelines")
    }
  }

  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col -m-6">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-card/30">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">{name}</h1>
          {dirty && (
            <span className="rounded bg-warning/10 px-2 py-0.5 text-[10px] text-warning font-medium">
              unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={deletePipeline}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Composition palette */}
        <div className="w-[180px] border-r border-border bg-card/30 p-2 overflow-y-auto">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
            Compositions
          </div>
          <div className="space-y-1">
            {compositions.map((comp) => (
              <button
                key={comp.id}
                onClick={() => addComposition(comp)}
                className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Plus className="h-3 w-3 shrink-0" />
                <span className="truncate">{comp.name}</span>
              </button>
            ))}
            {compositions.length === 0 && (
              <p className="text-[10px] text-muted-foreground/50 px-1">No compositions yet</p>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 min-w-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={(changes) => { onNodesChange(changes); setDirty(true) }}
            onEdgesChange={(changes) => { onEdgesChange(changes); setDirty(true) }}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            connectionLineStyle={{ stroke: "#3b82f6", strokeWidth: 2 }}
            defaultEdgeOptions={{
              type: "smoothstep",
              animated: true,
              style: { stroke: "#52525b", strokeWidth: 2 },
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#27272a" />
            <Controls className="!bg-card !border-border !rounded-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground" />
            <MiniMap
              className="!bg-card !border-border !rounded-lg"
              nodeColor="#27272a"
              maskColor="rgba(0,0,0,0.7)"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}

export function PipelineEditor(props: PipelineEditorProps) {
  return (
    <ReactFlowProvider>
      <PipelineEditorInner {...props} />
    </ReactFlowProvider>
  )
}
