"use client"

import { useState, useMemo } from "react"
import { assembleGraph } from "@/lib/graph-engine"
import { ChevronUp, ChevronDown, Blocks, Hash } from "lucide-react"

interface PreviewPanelProps {
  nodes: any[]
  edges: any[]
  blocks: Record<string, { name: string; content: string }>
  contextSchema: Array<{ name: string; type: string; values?: string[] }>
}

export function PreviewPanel({ nodes, edges, blocks, contextSchema }: PreviewPanelProps) {
  const [expanded, setExpanded] = useState(true)
  const [context, setContext] = useState<Record<string, any>>({})
  const [tab, setTab] = useState<"preview" | "blocks">("preview")

  const result = useMemo(() => {
    try {
      return assembleGraph(nodes, edges, blocks, context)
    } catch {
      return { text: "", blocks: [] as string[], tokenCount: 0, variantId: null }
    }
  }, [nodes, edges, blocks, context])

  return (
    <div className="border-t border-border bg-card">
      {/* Header bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-foreground font-semibold">Preview</span>
          <span className="font-mono">{result.tokenCount} tokens</span>
          <span>·</span>
          <span>{result.blocks.length} blocks</span>
          {result.blocks.length > 0 && (
            <>
              <span>·</span>
              <span className="text-success">{result.blocks.join(" → ")}</span>
            </>
          )}
          {result.variantId && (
            <>
              <span>·</span>
              <span className="text-amber-400">variant: {result.variantId}</span>
            </>
          )}
        </div>
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border/50">
            <button
              onClick={() => setTab("preview")}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                tab === "preview" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Assembled Output
            </button>
            <button
              onClick={() => setTab("blocks")}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                tab === "blocks" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Block Breakdown
            </button>
          </div>

          <div className="flex" style={{ height: 200 }}>
            {/* Left: Context inputs */}
            <div className="w-52 border-r border-border p-3 overflow-y-auto flex-shrink-0">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Test Context</div>
              {contextSchema.map((field) => (
                <div key={field.name} className="mb-3">
                  <label className="text-[10px] text-muted-foreground font-medium">{field.name}</label>
                  {field.type === "boolean" ? (
                    <select
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                      value={String(context[field.name] ?? "false")}
                      onChange={(e) => setContext({ ...context, [field.name]: e.target.value === "true" })}
                    >
                      <option value="false">false</option>
                      <option value="true">true</option>
                    </select>
                  ) : field.type === "enum" && field.values ? (
                    <select
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                      value={context[field.name] ?? field.values[0]}
                      onChange={(e) => setContext({ ...context, [field.name]: e.target.value })}
                    >
                      {field.values.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  ) : (
                    <input
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                      placeholder={`Enter ${field.name}...`}
                      value={context[field.name] ?? ""}
                      onChange={(e) => setContext({ ...context, [field.name]: e.target.value })}
                    />
                  )}
                </div>
              ))}
              {contextSchema.length === 0 && (
                <div className="text-[10px] text-muted-foreground italic py-4 text-center">
                  No context schema defined.
                  <br />
                  Click &quot;Schema&quot; in the toolbar to add parameters.
                </div>
              )}
            </div>

            {/* Right: Output */}
            <div className="flex-1 overflow-y-auto p-3">
              {tab === "preview" ? (
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {result.text || (
                    <span className="text-muted-foreground/50 italic">
                      Empty output. Make sure you have a connected path:
                      {"\n\n"}Start → Block(s) → Output
                      {"\n\n"}Drag a Block from the left palette, connect Start&apos;s green handle to the Block, then connect the Block to Output. The assembled prompt will appear here in real time.
                      {"\n\n"}If using IF nodes: Start → IF → Block (on true/false branch) → Merge → Output
                    </span>
                  )}
                </pre>
              ) : (
                <div className="space-y-2">
                  {result.blocks.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 italic py-4 text-center">
                      No blocks in the output path.
                    </p>
                  ) : (
                    result.blocks.map((blockName, i) => (
                      <div key={`${blockName}-${i}`} className="rounded-lg border border-border bg-background p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Blocks className="h-3 w-3 text-success" />
                          <span className="text-xs font-semibold text-foreground">{blockName}</span>
                          <span className="ml-auto font-mono text-[9px] text-muted-foreground">#{i + 1}</span>
                        </div>
                        <pre className="whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-muted-foreground/70 max-h-20 overflow-hidden">
                          {Object.values(blocks).find(b => b.name === blockName)?.content?.slice(0, 200) ?? "—"}
                          {(Object.values(blocks).find(b => b.name === blockName)?.content?.length ?? 0) > 200 ? "..." : ""}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
