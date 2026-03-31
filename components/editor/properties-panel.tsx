"use client"

import { useState, useEffect, useCallback } from "react"
import type { Node } from "@xyflow/react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { X, Plus, Trash2, FileText, ToggleLeft, List, Percent, Code2, Merge, Play, Flag } from "lucide-react"
import { cn } from "@/lib/utils"

interface BlockInfo {
  id: string
  name: string
  content: string
  description?: string
}

interface PropertiesPanelProps {
  node: Node | null
  blocks: BlockInfo[]
  onNodeDataChange: (nodeId: string, data: Record<string, unknown>) => void
  onClose: () => void
}

export function PropertiesPanel({ node, blocks, onNodeDataChange, onClose }: PropertiesPanelProps) {
  if (!node) return null

  return (
    <div className="flex h-full w-[264px] flex-col border-l border-border bg-card/50">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <NodeTypeIcon type={node.type ?? ""} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {nodeTypeLabel(node.type ?? "")}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NodeProperties
          node={node}
          blocks={blocks}
          onNodeDataChange={onNodeDataChange}
        />
      </div>
    </div>
  )
}

function NodeTypeIcon({ type }: { type: string }) {
  const cls = "h-3.5 w-3.5"
  switch (type) {
    case "block": return <FileText className={cn(cls, "text-green-400")} />
    case "ifBoolean": return <ToggleLeft className={cn(cls, "text-primary")} />
    case "ifSwitch": return <List className={cn(cls, "text-primary")} />
    case "ifPercentage": return <Percent className={cn(cls, "text-primary")} />
    case "ifExpression": return <Code2 className={cn(cls, "text-primary")} />
    case "merge": return <Merge className={cn(cls, "text-primary")} />
    case "start": return <Play className={cn(cls, "text-primary")} />
    case "promptOutput": return <Flag className={cn(cls, "text-success")} />
    default: return null
  }
}

function nodeTypeLabel(type: string): string {
  switch (type) {
    case "block": return "Block"
    case "ifBoolean": return "IF Boolean"
    case "ifSwitch": return "IF Switch"
    case "ifPercentage": return "IF Percentage"
    case "ifExpression": return "IF Expression"
    case "merge": return "Merge"
    case "start": return "Start"
    case "promptOutput": return "Output"
    default: return type
  }
}

function NodeProperties({
  node,
  blocks,
  onNodeDataChange,
}: {
  node: Node
  blocks: BlockInfo[]
  onNodeDataChange: (nodeId: string, data: Record<string, unknown>) => void
}) {
  const type = node.type ?? ""
  const data = node.data as Record<string, unknown>

  switch (type) {
    case "block":
      return <BlockProperties nodeId={node.id} data={data} blocks={blocks} onChange={onNodeDataChange} />
    case "ifBoolean":
      return <IfBooleanProperties nodeId={node.id} data={data} onChange={onNodeDataChange} />
    case "ifSwitch":
      return <IfSwitchProperties nodeId={node.id} data={data} onChange={onNodeDataChange} />
    case "ifPercentage":
      return <IfPercentageProperties nodeId={node.id} data={data} onChange={onNodeDataChange} />
    case "ifExpression":
      return <IfExpressionProperties nodeId={node.id} data={data} onChange={onNodeDataChange} />
    default:
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-muted/50 p-3 mb-3">
            <NodeTypeIcon type={type} />
          </div>
          <p className="text-xs text-muted-foreground">No configuration needed</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {type === "start" ? "Context is injected at runtime" :
             type === "promptOutput" ? "Collects the assembled prompt" :
             type === "merge" ? "Joins multiple branches" : ""}
          </p>
        </div>
      )
  }
}

/* ─── Block Properties ─── */
function BlockProperties({
  nodeId,
  data,
  blocks,
  onChange,
}: {
  nodeId: string
  data: Record<string, unknown>
  blocks: BlockInfo[]
  onChange: (nodeId: string, data: Record<string, unknown>) => void
}) {
  const blockId = data.blockId as string
  const selectedBlock = blocks.find((b) => b.id === blockId)

  return (
    <div className="space-y-3">
      <FieldLabel label="Block">
        <select
          value={blockId || ""}
          onChange={(e) => {
            const chosen = blocks.find((b) => b.id === e.target.value)
            onChange(nodeId, {
              blockId: e.target.value,
              label: chosen?.name ?? "New Block",
              tokenCount: chosen ? Math.round(chosen.content.length / 4) : 0,
              description: chosen?.description ?? "",
            })
          }}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
        >
          <option value="">Select a block...</option>
          {blocks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </FieldLabel>

      {selectedBlock && (
        <>
          <FieldLabel label="Preview">
            <div className="rounded-md border border-border bg-background/50 p-2">
              <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-muted-foreground max-h-32 overflow-y-auto">
                {selectedBlock.content.slice(0, 200)}
                {selectedBlock.content.length > 200 && "..."}
              </pre>
            </div>
          </FieldLabel>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="font-mono">{Math.round(selectedBlock.content.length / 4)} tokens</span>
            <span className="text-border">|</span>
            <span>{selectedBlock.content.length} chars</span>
          </div>
        </>
      )}
    </div>
  )
}

/* ─── IF Boolean Properties ─── */
function IfBooleanProperties({
  nodeId,
  data,
  onChange,
}: {
  nodeId: string
  data: Record<string, unknown>
  onChange: (nodeId: string, data: Record<string, unknown>) => void
}) {
  const [field, setField] = useState(data.field as string ?? "")

  const commit = useCallback(() => {
    onChange(nodeId, { field })
  }, [nodeId, field, onChange])

  useEffect(() => {
    setField(data.field as string ?? "")
  }, [data.field])

  return (
    <div className="space-y-3">
      <FieldLabel label="Context field">
        <Input
          value={field}
          onChange={(e) => setField(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit() }}
          placeholder="e.g. hasAuth"
          className="h-8 text-xs"
        />
      </FieldLabel>
      <div className="rounded-md border border-border bg-background/50 px-2.5 py-2 space-y-1">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="text-[9px] font-mono text-success">true</span>
          <span className="text-[9px] text-muted-foreground ml-auto">right-top handle</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
          <span className="text-[9px] font-mono text-destructive">false</span>
          <span className="text-[9px] text-muted-foreground ml-auto">right-bottom handle</span>
        </div>
      </div>
    </div>
  )
}

/* ─── IF Switch Properties ─── */
function IfSwitchProperties({
  nodeId,
  data,
  onChange,
}: {
  nodeId: string
  data: Record<string, unknown>
  onChange: (nodeId: string, data: Record<string, unknown>) => void
}) {
  const [field, setField] = useState(data.field as string ?? "")
  const [cases, setCases] = useState<string[]>((data.cases as string[]) ?? [])
  const [newCase, setNewCase] = useState("")

  useEffect(() => {
    setField(data.field as string ?? "")
    setCases((data.cases as string[]) ?? [])
  }, [data.field, data.cases])

  const commitField = useCallback(() => {
    onChange(nodeId, { field })
  }, [nodeId, field, onChange])

  const addCase = useCallback(() => {
    if (!newCase.trim()) return
    const updated = [...cases, newCase.trim()]
    setCases(updated)
    setNewCase("")
    onChange(nodeId, { cases: updated })
  }, [nodeId, cases, newCase, onChange])

  const removeCase = useCallback((index: number) => {
    const updated = cases.filter((_, i) => i !== index)
    setCases(updated)
    onChange(nodeId, { cases: updated })
  }, [nodeId, cases, onChange])

  return (
    <div className="space-y-3">
      <FieldLabel label="Context field">
        <Input
          value={field}
          onChange={(e) => setField(e.target.value)}
          onBlur={commitField}
          onKeyDown={(e) => { if (e.key === "Enter") commitField() }}
          placeholder="e.g. userRole"
          className="h-8 text-xs"
        />
      </FieldLabel>
      <FieldLabel label="Cases">
        <div className="space-y-1">
          {cases.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <div
                className="h-2 w-2 rounded-sm shrink-0"
                style={{ background: ["#f59e0b", "#06b6d4", "#6b7280", "#ec4899", "#8b5cf6"][i % 5] }}
              />
              <span className="flex-1 text-xs font-mono text-foreground">{c}</span>
              <button
                onClick={() => removeCase(i)}
                className="rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1 mt-1.5">
            <Input
              value={newCase}
              onChange={(e) => setNewCase(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addCase() }}
              placeholder="Add case..."
              className="h-7 text-xs flex-1"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={addCase}
              disabled={!newCase.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </FieldLabel>
    </div>
  )
}

/* ─── IF Percentage Properties ─── */
function IfPercentageProperties({
  nodeId,
  data,
  onChange,
}: {
  nodeId: string
  data: Record<string, unknown>
  onChange: (nodeId: string, data: Record<string, unknown>) => void
}) {
  const [variants, setVariants] = useState<Array<{ name: string; weight: number }>>(
    (data.variants as Array<{ name: string; weight: number }>) ?? []
  )
  const [newName, setNewName] = useState("")
  const [newWeight, setNewWeight] = useState(50)

  useEffect(() => {
    setVariants((data.variants as Array<{ name: string; weight: number }>) ?? [])
  }, [data.variants])

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0)

  const addVariant = useCallback(() => {
    if (!newName.trim()) return
    const updated = [...variants, { name: newName.trim(), weight: newWeight }]
    setVariants(updated)
    setNewName("")
    setNewWeight(50)
    onChange(nodeId, { variants: updated })
  }, [nodeId, variants, newName, newWeight, onChange])

  const removeVariant = useCallback((index: number) => {
    const updated = variants.filter((_, i) => i !== index)
    setVariants(updated)
    onChange(nodeId, { variants: updated })
  }, [nodeId, variants, onChange])

  const updateVariantWeight = useCallback((index: number, weight: number) => {
    const updated = variants.map((v, i) => (i === index ? { ...v, weight } : v))
    setVariants(updated)
    onChange(nodeId, { variants: updated })
  }, [nodeId, variants, onChange])

  return (
    <div className="space-y-3">
      <FieldLabel label="Variants">
        <div className="space-y-1.5">
          {variants.map((v, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: ["#4ade80", "#f59e0b", "#06b6d4", "#ec4899", "#8b5cf6"][i % 5] }}
              />
              <span className="text-xs font-mono text-foreground min-w-0 flex-1 truncate">{v.name}</span>
              <Input
                type="number"
                value={v.weight}
                onChange={(e) => updateVariantWeight(i, parseInt(e.target.value) || 0)}
                className="h-7 w-14 text-xs text-center"
                min={0}
                max={100}
              />
              <span className="text-[10px] text-muted-foreground">%</span>
              <button
                onClick={() => removeVariant(i)}
                className="rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </FieldLabel>

      <div className="flex items-center gap-1.5">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addVariant() }}
          placeholder="Variant name"
          className="h-7 text-xs flex-1"
        />
        <Input
          type="number"
          value={newWeight}
          onChange={(e) => setNewWeight(parseInt(e.target.value) || 0)}
          className="h-7 w-14 text-xs text-center"
          min={0}
          max={100}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={addVariant}
          disabled={!newName.trim()}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className={cn(
        "rounded-md border px-2.5 py-1.5 text-[10px] font-mono",
        totalWeight === 100
          ? "border-success/30 bg-success/5 text-success"
          : "border-warning/30 bg-warning/5 text-warning"
      )}>
        Total: {totalWeight}%{totalWeight !== 100 && " (should be 100%)"}
      </div>
    </div>
  )
}

/* ─── IF Expression Properties ─── */
function IfExpressionProperties({
  nodeId,
  data,
  onChange,
}: {
  nodeId: string
  data: Record<string, unknown>
  onChange: (nodeId: string, data: Record<string, unknown>) => void
}) {
  const [expression, setExpression] = useState(data.expression as string ?? "")

  useEffect(() => {
    setExpression(data.expression as string ?? "")
  }, [data.expression])

  const commit = useCallback(() => {
    onChange(nodeId, { expression })
  }, [nodeId, expression, onChange])

  return (
    <div className="space-y-3">
      <FieldLabel label="Expression">
        <Textarea
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          onBlur={commit}
          placeholder={'e.g. _time.hour >= 18 && _req.country == "TR"'}
          className="min-h-[80px] font-mono text-xs resize-none"
        />
      </FieldLabel>
      <div className="rounded-md border border-border bg-background/50 px-2.5 py-2 space-y-1">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="text-[9px] font-mono text-success">true</span>
          <span className="text-[9px] text-muted-foreground ml-auto">right-top handle</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
          <span className="text-[9px] font-mono text-destructive">false</span>
          <span className="text-[9px] text-muted-foreground ml-auto">right-bottom handle</span>
        </div>
      </div>
      <div className="text-[9px] text-muted-foreground leading-relaxed">
        <p className="font-medium mb-0.5">Available context:</p>
        <code className="text-[8px]">_time.hour, _req.country, _req.userId</code>
        <p className="mt-1">Plus any fields from your context schema.</p>
      </div>
    </div>
  )
}

/* ─── Shared ─── */
function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
        {label}
      </label>
      {children}
    </div>
  )
}
