"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { FlowCanvas, type FlowCanvasHandle } from "@/components/editor/flow-canvas"
import { NodePalette } from "@/components/editor/node-palette"
import { PropertiesPanel } from "@/components/editor/properties-panel"
import { PreviewPanel } from "@/components/editor/preview-panel"
import { ContextSchemaEditor, type ContextField } from "@/components/editor/context-schema-editor"
import { EvalConfigPanel } from "./eval-config-panel"
import { Button } from "@/components/ui/button"
import { Save, Trash2, Rocket, FlaskConical, Braces, Eye } from "lucide-react"
import { toast } from "sonner"
import type { Node, Edge } from "@xyflow/react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

interface BlockInfo {
  id: string
  name: string
  content: string
  description?: string
}

interface CompositionEditorProps {
  id: string
  name: string
  version: number
  initialNodes: Node[]
  initialEdges: Edge[]
  contextSchema: ContextField[]
}

export function CompositionEditor({
  id,
  name,
  version,
  initialNodes,
  initialEdges,
  contextSchema: initialContextSchema,
}: CompositionEditorProps) {
  const router = useRouter()
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deployOpen, setDeployOpen] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [evalOpen, setEvalOpen] = useState(false)
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [blocks, setBlocks] = useState<BlockInfo[]>([])
  const [contextSchema, setContextSchema] = useState<ContextField[]>(initialContextSchema ?? [])
  const [previewOpen, setPreviewOpen] = useState(true)
  const [liveNodes, setLiveNodes] = useState<Node[]>(initialNodes)
  const [liveEdges, setLiveEdges] = useState<Edge[]>(initialEdges)

  const graphRef = useRef<{ nodes: Node[]; edges: Edge[] }>({
    nodes: initialNodes,
    edges: initialEdges,
  })
  const initialRef = useRef(true)
  const canvasRef = useRef<FlowCanvasHandle>(null)

  /* Fetch blocks for the block selector and preview */
  useEffect(() => {
    fetch("/api/blocks")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setBlocks(data)
      })
      .catch(() => {
        /* silently fail — blocks won't be available in the selector */
      })
  }, [])

  /* Graph change callback */
  const onGraphChange = useCallback((nodes: Node[], edges: Edge[]) => {
    graphRef.current = { nodes, edges }
    setLiveNodes(nodes)
    setLiveEdges(edges)
    if (initialRef.current) {
      initialRef.current = false
      return
    }
    setDirty(true)
  }, [])

  /* Node selection */
  const onNodeSelect = useCallback((node: Node | null) => {
    setSelectedNode(node)
  }, [])

  /* Update node data from properties panel */
  const onNodeDataChange = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      canvasRef.current?.updateNodeData(nodeId, data)
      // Also update the selected node's data locally so the panel re-renders
      setSelectedNode((prev) => {
        if (!prev || prev.id !== nodeId) return prev
        return { ...prev, data: { ...prev.data, ...data } }
      })
      setDirty(true)
    },
    []
  )

  /* Context schema change */
  const onSchemaChange = useCallback((schema: ContextField[]) => {
    setContextSchema(schema)
    setDirty(true)
  }, [])

  /* Save */
  async function save() {
    setSaving(true)
    const res = await fetch(`/api/compositions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        graph: graphRef.current,
        contextSchema,
      }),
    })
    if (res.ok) {
      setDirty(false)
      toast.success("Composition saved")
      router.refresh()
    } else {
      toast.error("Failed to save")
    }
    setSaving(false)
  }

  /* Delete */
  async function deleteComposition() {
    if (!confirm("Delete this composition? This cannot be undone.")) return
    const res = await fetch(`/api/compositions/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("Composition deleted")
      router.push("/compositions")
    }
  }

  /* Deploy */
  async function deploy(environment: string) {
    setDeploying(true)
    const res = await fetch(`/api/compositions/${id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environment }),
    })
    if (res.ok) {
      toast.success(`Deployed to ${environment}`)
      setDeployOpen(false)
    } else {
      const data = await res.json()
      toast.error(data.error ?? "Deploy failed")
    }
    setDeploying(false)
  }

  /* Block lookup for preview panel */
  const blockLookup = blocks.reduce<Record<string, { name: string; content: string }>>((acc, b) => {
    acc[b.id] = { name: b.name, content: b.content }
    return acc
  }, {})

  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col -m-6">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-card/30">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">{name}</h1>
          <span className="rounded bg-success/10 px-2 py-0.5 font-mono text-[10px] text-success">
            v{version}
          </span>
          {dirty && (
            <span className="rounded bg-warning/10 px-2 py-0.5 text-[10px] text-warning font-medium">
              unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={deleteComposition}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant={previewOpen ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => setPreviewOpen(!previewOpen)}
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setSchemaOpen(true)}
          >
            <Braces className="h-3.5 w-3.5" /> Schema
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setEvalOpen(true)}
          >
            <FlaskConical className="h-3.5 w-3.5" /> Evals
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setDeployOpen(true)}
          >
            <Rocket className="h-3.5 w-3.5" /> Deploy
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={save}
            disabled={!dirty || saving}
          >
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* ── Main editor area ── */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Node Palette */}
        <NodePalette />

        {/* Center: Flow Canvas */}
        <div className="flex-1 min-w-0">
          <FlowCanvas
            ref={canvasRef}
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            onGraphChange={onGraphChange}
            onNodeSelect={onNodeSelect}
          />
        </div>

        {/* Right: Properties Panel (when a node is selected) */}
        {selectedNode && (
          <PropertiesPanel
            node={selectedNode}
            blocks={blocks}
            onNodeDataChange={onNodeDataChange}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>

      {/* ── Bottom: Preview Panel ── */}
      {previewOpen && (
        <PreviewPanel
          nodes={liveNodes}
          edges={liveEdges}
          blocks={blockLookup}
          contextSchema={contextSchema}
        />
      )}

      {/* ── Dialogs ── */}
      <ContextSchemaEditor
        open={schemaOpen}
        onOpenChange={setSchemaOpen}
        schema={contextSchema}
        onSchemaChange={onSchemaChange}
      />

      <EvalConfigPanel
        compositionId={id}
        open={evalOpen}
        onOpenChange={setEvalOpen}
      />

      <Dialog open={deployOpen} onOpenChange={setDeployOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deploy Composition</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deploy <span className="font-medium text-foreground">{name}</span> v{version} to
            an environment.
          </p>
          <div className="flex flex-col gap-2">
            {(["dev", "staging", "prod"] as const).map((env) => (
              <Button
                key={env}
                variant="outline"
                className="justify-start gap-2"
                disabled={deploying}
                onClick={() => deploy(env)}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    env === "prod"
                      ? "bg-red-500"
                      : env === "staging"
                        ? "bg-yellow-500"
                        : "bg-green-500"
                  }`}
                />
                {env}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
