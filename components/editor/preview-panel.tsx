"use client"

import { useState, useMemo, useEffect } from "react"
import { assembleGraph } from "@/lib/graph-engine"
import { ChevronUp, ChevronDown, Blocks, Hash } from "lucide-react"

interface PreviewPanelProps {
  nodes: any[]
  edges: any[]
  blocks: Record<string, { name: string; content: string; role?: string | null }>
  contextSchema: Array<{ name: string; type: string; values?: string[] }>
}

export function PreviewPanel({ nodes, edges, blocks, contextSchema }: PreviewPanelProps) {
  const [expanded, setExpanded] = useState(true)
  const [context, setContext] = useState<Record<string, any>>({})
  const [tab, setTab] = useState<"preview" | "messages" | "blocks">("preview")
  const [autoMetaOpen, setAutoMetaOpen] = useState(false)
  const [autoMeta, setAutoMeta] = useState({
    hour: new Date().getHours(),
    dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()],
    country: "US",
    userId: "test-user-1",
  })

  useEffect(() => {
    const defaults: Record<string, any> = {}
    for (const field of contextSchema) {
      if (field.type === "boolean") defaults[field.name] = false
      else if (field.type === "enum" && field.values?.length) defaults[field.name] = field.values[0]
      else if (field.type === "number") defaults[field.name] = 0
      else defaults[field.name] = ""
    }
    setContext(prev => {
      // Merge: keep existing user values, fill in new defaults
      const merged = { ...defaults }
      for (const key of Object.keys(prev)) {
        if (key in merged) merged[key] = prev[key]
      }
      return merged
    })
  }, [contextSchema])

  const result = useMemo(() => {
    try {
      const fullContext = { ...context, _time: { hour: autoMeta.hour, dayOfWeek: autoMeta.dayOfWeek }, _req: { country: autoMeta.country, userId: autoMeta.userId } }
      return assembleGraph(nodes, edges, blocks, fullContext)
    } catch (e) {
      return { text: "", blocks: [] as string[], skippedBlocks: [] as string[], tokenCount: 0, errors: [e instanceof Error ? e.message : "Assembly failed"] }
    }
  }, [nodes, edges, blocks, context, autoMeta])

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
          {result.skippedBlocks?.length > 0 && (
            <>
              <span>·</span>
              <span className="text-muted-foreground/60">{result.skippedBlocks.length} skipped</span>
            </>
          )}
          {result.blocks.length > 0 && (
            <>
              <span>·</span>
              <span className="text-success">{result.blocks.join(" → ")}</span>
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
              onClick={() => setTab("messages")}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                tab === "messages" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Messages
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
                  ) : field.type === "number" ? (
                    <input
                      type="number"
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                      value={context[field.name] ?? 0}
                      onChange={(e) => setContext({ ...context, [field.name]: parseFloat(e.target.value) || 0 })}
                    />
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
              {/* Auto-captured metadata */}
              <div className="mt-2 border-t border-border/50 pt-2">
                <button
                  onClick={() => setAutoMetaOpen(!autoMetaOpen)}
                  className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold hover:text-muted-foreground transition-colors"
                >
                  {autoMetaOpen ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronUp className="h-2.5 w-2.5" />}
                  Auto-captured (test)
                </button>
                {autoMetaOpen && (
                  <div className="mt-2 space-y-3">
                    <div>
                      <label className="text-[10px] text-muted-foreground/60 font-medium">_time.hour</label>
                      <input
                        type="number"
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                        value={autoMeta.hour}
                        onChange={(e) => setAutoMeta({ ...autoMeta, hour: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground/60 font-medium">_time.dayOfWeek</label>
                      <select
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                        value={autoMeta.dayOfWeek}
                        onChange={(e) => setAutoMeta({ ...autoMeta, dayOfWeek: e.target.value })}
                      >
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground/60 font-medium">_req.country</label>
                      <input
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                        value={autoMeta.country}
                        onChange={(e) => setAutoMeta({ ...autoMeta, country: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground/60 font-medium">_req.userId</label>
                      <input
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                        value={autoMeta.userId}
                        onChange={(e) => setAutoMeta({ ...autoMeta, userId: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Output */}
            <div className="flex-1 overflow-y-auto">
              {result.errors?.length > 0 && (
                <div className="mx-3 mt-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2">
                  <div className="text-[10px] font-semibold text-warning mb-1">Assembly warnings</div>
                  {result.errors.map((err, i) => (
                    <div key={i} className="text-[10px] text-warning/80 font-mono">• {err}</div>
                  ))}
                </div>
              )}
              <div className="p-3">
              {tab === "messages" ? (
                <div className="space-y-2">
                  {(result as any).messages?.length > 0 ? (
                    (result as any).messages.map((msg: { role: string; content: string }, i: number) => (
                      <div key={i} className="rounded-lg border border-border bg-background p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`rounded px-1.5 py-px text-[9px] font-semibold uppercase ${
                            msg.role === "system" ? "bg-blue-500/20 text-blue-400" :
                            msg.role === "user" ? "bg-amber-500/20 text-amber-400" :
                            "bg-purple-500/20 text-purple-400"
                          }`}>
                            {msg.role}
                          </span>
                          <span className="ml-auto font-mono text-[9px] text-muted-foreground">{msg.content.length} chars</span>
                        </div>
                        <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-muted-foreground/80 max-h-32 overflow-y-auto">
                          {msg.content}
                        </pre>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground/50 italic py-4 text-center">
                      No messages assembled. Connect blocks to see the message output.
                    </p>
                  )}
                </div>
              ) : tab === "preview" ? (
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
                  {result.skippedBlocks?.length > 0 && (
                    <>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-semibold mt-3 mb-1">Skipped</div>
                      {result.skippedBlocks.map((blockName, i) => (
                        <div key={`skipped-${blockName}-${i}`} className="rounded-lg border border-border/50 bg-background/50 p-2 opacity-50">
                          <div className="flex items-center gap-2">
                            <Blocks className="h-3 w-3 text-muted-foreground/40" />
                            <span className="text-xs font-medium text-muted-foreground/60">{blockName}</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
