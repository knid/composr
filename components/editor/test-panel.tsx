"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Play, Loader2 } from "lucide-react"
import type { ContextField } from "@/components/editor/context-schema-editor"

interface TestPanelProps {
  compositionId: string
  contextSchema: ContextField[]
}

function generateSkeleton(schema: ContextField[]): string {
  const obj: Record<string, any> = {}
  for (const field of schema) {
    const parts = field.name.split(".")
    let current = obj
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {}
      current = current[parts[i]]
    }
    const last = parts[parts.length - 1]
    switch (field.type) {
      case "boolean": current[last] = false; break
      case "number": current[last] = 0; break
      default: current[last] = ""
    }
  }
  return JSON.stringify(obj, null, 2)
}

interface ToolCallEvent {
  tool: string
  input: Record<string, any>
}

export function TestPanel({ compositionId, contextSchema }: TestPanelProps) {
  const [contextText, setContextText] = useState(() => generateSkeleton(contextSchema))
  const [userMessage, setUserMessage] = useState("")
  const [environment, setEnvironment] = useState("dev")
  const [running, setRunning] = useState(false)
  const [response, setResponse] = useState("")
  const [toolCalls, setToolCalls] = useState<ToolCallEvent[]>([])
  const [metrics, setMetrics] = useState<{ latencyMs?: number; inputTokens?: number; outputTokens?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function run() {
    setRunning(true)
    setResponse("")
    setToolCalls([])
    setMetrics(null)
    setError(null)

    let context: Record<string, any> = {}
    try {
      context = JSON.parse(contextText)
    } catch {
      setError("Invalid JSON in context")
      setRunning(false)
      return
    }

    abortRef.current = new AbortController()

    try {
      const res = await fetch("/api/playground/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compositionId, context, userMessage, environment }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Request failed")
        setRunning(false)
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const event = JSON.parse(line.slice(6))
          switch (event.type) {
            case "text_delta":
              setResponse((prev) => prev + event.content)
              break
            case "tool_use":
              setToolCalls((prev) => [...prev, { tool: event.tool, input: event.input }])
              break
            case "done":
              setMetrics({ latencyMs: event.latencyMs, inputTokens: event.inputTokens, outputTokens: event.outputTokens })
              break
            case "error":
              setError(event.error)
              break
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message)
      }
    }
    setRunning(false)
  }

  return (
    <div className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
          Context
        </label>
        <textarea
          value={contextText}
          onChange={(e) => setContextText(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground resize-none"
          rows={6}
          spellCheck={false}
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
            Environment
          </label>
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          >
            <option value="dev">dev</option>
            <option value="staging">staging</option>
            <option value="prod">prod</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button size="sm" onClick={run} disabled={running} className="gap-1.5">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {running ? "Running..." : "Run"}
          </Button>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
          User Message
        </label>
        <Input
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          placeholder="Type a test message..."
          className="text-xs"
          onKeyDown={(e) => { if (e.key === "Enter" && !running) run() }}
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {(response || toolCalls.length > 0) && (
        <div className="border-t border-border pt-3">
          <label className="text-[10px] font-medium uppercase tracking-wider text-emerald-500 mb-1 block">
            Response
          </label>
          {response && (
            <div className="rounded-md border border-border bg-background/50 px-3 py-2 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
              {response}
            </div>
          )}
          {toolCalls.map((tc, i) => (
            <div key={i} className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <div className="text-[10px] font-medium text-amber-500 mb-1">Tool Call: {tc.tool}</div>
              <pre className="text-[10px] font-mono text-muted-foreground">
                {JSON.stringify(tc.input, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}

      {metrics && (
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          {metrics.latencyMs && <span>{(metrics.latencyMs / 1000).toFixed(1)}s</span>}
          {metrics.inputTokens && <span>In: {metrics.inputTokens}</span>}
          {metrics.outputTokens && <span>Out: {metrics.outputTokens}</span>}
        </div>
      )}
    </div>
  )
}
