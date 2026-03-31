"use client"

import { useState } from "react"
import { Search, ChevronDown, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface LogEntry {
  id: string
  assemblyId: string
  compositionId: string
  compositionName: string
  compositionVersion: number
  environment: string
  variantId: string | null
  model: string | null
  latencyMs: number | null
  overallScore: number | null
  evalStatus: string
  input: string | null
  output: string | null
  context: any
  autoScores: Record<string, any>
  manualScores: Record<string, any>
  createdAt: string
}

interface LogTableProps {
  logs: LogEntry[]
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso))
}

function formatLatency(ms: number | null) {
  if (ms === null) return "\u2014"
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

export function LogTable({ logs }: LogTableProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [envFilter, setEnvFilter] = useState("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = logs.filter((log) => {
    if (statusFilter !== "all" && log.evalStatus !== statusFilter) return false
    if (envFilter !== "all" && log.environment !== envFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const searchable = [log.compositionName, log.model, log.variantId, log.assemblyId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      if (!searchable.includes(q)) return false
    }
    return true
  })

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="space-y-3">
      {/* Search and filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search compositions, models, variants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1.5 text-xs h-8"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
        <select
          value={envFilter}
          onChange={(e) => setEnvFilter(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1.5 text-xs h-8"
        >
          <option value="all">All environments</option>
          <option value="dev">Dev</option>
          <option value="staging">Staging</option>
          <option value="prod">Prod</option>
        </select>
        {filtered.length !== logs.length && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {filtered.length} of {logs.length}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="w-6 px-2 py-2" />
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Composition</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Version</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Variant</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Model</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Latency</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Score</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Eval Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  No logs match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <>
                  <tr
                    key={log.id}
                    onClick={() => toggleRow(log.id)}
                    className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer select-none"
                  >
                    <td className="px-2 py-2 text-muted-foreground">
                      {expandedId === log.id ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums whitespace-nowrap">
                      {formatTime(log.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-medium">{log.compositionName}</td>
                    <td className="px-3 py-2 text-muted-foreground">v{log.compositionVersion}</td>
                    <td className="px-3 py-2">
                      {log.variantId ? (
                        <Badge variant="secondary" className="text-[10px]">{log.variantId}</Badge>
                      ) : (
                        <span className="text-muted-foreground/50">{"\u2014"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{log.model ?? "\u2014"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {formatLatency(log.latencyMs)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {log.overallScore !== null ? (
                        <span className="font-medium">{log.overallScore}/100</span>
                      ) : (
                        <span className="text-muted-foreground/50">{"\u2014"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {log.evalStatus === "completed" ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-green-500/10 text-green-500">completed</span>
                      ) : log.evalStatus === "pending" ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-yellow-500/10 text-yellow-500">pending</span>
                      ) : log.evalStatus === "failed" ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-500/10 text-red-500">failed</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">{log.evalStatus}</span>
                      )}
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr key={`${log.id}-detail`}>
                      <td colSpan={9} className="px-3 py-3 bg-muted/10 border-b border-border">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <div className="text-[10px] font-semibold text-muted-foreground mb-1">Assembly ID</div>
                            <code className="font-mono text-[10px]">{log.assemblyId}</code>
                          </div>
                          <div>
                            <div className="text-[10px] font-semibold text-muted-foreground mb-1">Environment</div>
                            <span>{log.environment}</span>
                          </div>
                          {log.input && (
                            <div className="col-span-2">
                              <div className="text-[10px] font-semibold text-muted-foreground mb-1">Input</div>
                              <pre className="whitespace-pre-wrap font-mono text-[10px] text-muted-foreground max-h-32 overflow-y-auto bg-background rounded p-2 border border-border">{log.input}</pre>
                            </div>
                          )}
                          {log.output && (
                            <div className="col-span-2">
                              <div className="text-[10px] font-semibold text-muted-foreground mb-1">Output</div>
                              <pre className="whitespace-pre-wrap font-mono text-[10px] text-muted-foreground max-h-32 overflow-y-auto bg-background rounded p-2 border border-border">{log.output}</pre>
                            </div>
                          )}
                          {log.context && Object.keys(log.context).length > 0 && (
                            <div className="col-span-2">
                              <div className="text-[10px] font-semibold text-muted-foreground mb-1">Context</div>
                              <pre className="whitespace-pre-wrap font-mono text-[10px] text-muted-foreground max-h-24 overflow-y-auto bg-background rounded p-2 border border-border">{JSON.stringify(log.context, null, 2)}</pre>
                            </div>
                          )}
                          {log.autoScores && Object.keys(log.autoScores).length > 0 && (
                            <div>
                              <div className="text-[10px] font-semibold text-muted-foreground mb-1">Auto Scores</div>
                              <div className="space-y-1">
                                {Object.entries(log.autoScores).map(([name, data]: [string, any]) => (
                                  <div key={name} className="flex justify-between">
                                    <span>{name}</span>
                                    <span className="font-mono font-medium">{data.score ?? data}/100</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {log.manualScores && Object.keys(log.manualScores).length > 0 && (
                            <div>
                              <div className="text-[10px] font-semibold text-muted-foreground mb-1">Manual Scores</div>
                              <div className="space-y-1">
                                {Object.entries(log.manualScores).map(([name, value]: [string, any]) => (
                                  <div key={name} className="flex justify-between">
                                    <span>{name}</span>
                                    <span className="font-mono font-medium">{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
