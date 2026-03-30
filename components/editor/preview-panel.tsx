"use client"

import { useState, useMemo } from "react"
import { assembleGraph } from "@/lib/graph-engine"
import { ChevronUp, ChevronDown } from "lucide-react"

interface PreviewPanelProps {
  nodes: any[]
  edges: any[]
  blocks: Record<string, { name: string; content: string }>
  contextSchema: Array<{ name: string; type: string; values?: string[] }>
}

export function PreviewPanel({ nodes, edges, blocks, contextSchema }: PreviewPanelProps) {
  const [expanded, setExpanded] = useState(true)
  const [context, setContext] = useState<Record<string, any>>({})

  const result = useMemo(() => {
    try {
      return assembleGraph(nodes, edges, blocks, context)
    } catch {
      return { text: "", blocks: [] as string[], tokenCount: 0 }
    }
  }, [nodes, edges, blocks, context])

  return (
    <div className="border-t border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <span>Preview · {result.tokenCount} tokens · {result.blocks.length} blocks</span>
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>
      {expanded && (
        <div className="flex border-t border-border" style={{ maxHeight: 240 }}>
          <div className="w-48 border-r border-border p-3 overflow-y-auto">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-2">Test Context</div>
            {contextSchema.map((field) => (
              <div key={field.name} className="mb-2">
                <label className="text-[10px] text-muted-foreground">{field.name}</label>
                {field.type === "boolean" ? (
                  <select
                    className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-xs"
                    value={String(context[field.name] ?? "false")}
                    onChange={(e) => setContext({ ...context, [field.name]: e.target.value === "true" })}
                  >
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                ) : field.type === "enum" && field.values ? (
                  <select
                    className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-xs"
                    value={context[field.name] ?? field.values[0]}
                    onChange={(e) => setContext({ ...context, [field.name]: e.target.value })}
                  >
                    {field.values.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <input
                    className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-xs"
                    value={context[field.name] ?? ""}
                    onChange={(e) => setContext({ ...context, [field.name]: e.target.value })}
                  />
                )}
              </div>
            ))}
            {contextSchema.length === 0 && (
              <p className="text-[10px] text-muted-foreground italic">No context schema defined</p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-muted-foreground">
              {result.text || "Empty — add blocks to the flow."}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
