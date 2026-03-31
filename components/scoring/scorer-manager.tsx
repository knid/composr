"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

interface EvalConfig {
  id: string
  compositionId: string
  scorerName: string
  type: string
  enabled: boolean
  sampleRate: number
  judgeModel: string
  judgePrompt: string | null
  weight: number
}

interface ScorerManagerProps {
  compositions: Array<{ id: string; name: string }>
}

const TYPE_LABELS: Record<string, string> = {
  llm_judge: "LLM Judge",
  code: "Code",
  structured_output: "Structured Output",
}

const TYPE_COLORS: Record<string, string> = {
  llm_judge: "bg-primary/10 text-primary",
  code: "bg-cyan-500/10 text-cyan-400",
  structured_output: "bg-green-500/10 text-green-400",
}

export function ScorerManager({ compositions }: ScorerManagerProps) {
  const [configs, setConfigs] = useState<EvalConfig[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState("llm_judge")
  const [newCompId, setNewCompId] = useState("")
  const [newSampleRate, setNewSampleRate] = useState(20)
  const [newWeight, setNewWeight] = useState(1)
  const [newJudgeModel, setNewJudgeModel] = useState("claude-sonnet-4-6-20250514")
  const [newJudgePrompt, setNewJudgePrompt] = useState("")
  const [creating, setCreating] = useState(false)

  const compNameMap = new Map(compositions.map((c) => [c.id, c.name]))

  useEffect(() => {
    fetch("/api/eval-configs")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setConfigs(data) })
      .catch(() => {})
  }, [])

  async function create() {
    setCreating(true)
    const res = await fetch("/api/eval-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compositionId: newCompId,
        scorerName: newName,
        type: newType,
        sampleRate: newSampleRate,
        weight: newWeight,
        judgeModel: newType === "llm_judge" ? newJudgeModel : undefined,
        judgePrompt: newType === "llm_judge" ? newJudgePrompt || undefined : newType === "code" ? newJudgePrompt || undefined : undefined,
      }),
    })
    if (res.ok) {
      const config = await res.json()
      setConfigs([...configs, config])
      setCreateOpen(false)
      setNewName("")
      setNewJudgePrompt("")
      toast.success("Scorer created")
    } else {
      const data = await res.json()
      toast.error(data.error ?? "Failed to create scorer")
    }
    setCreating(false)
  }

  async function toggle(id: string, enabled: boolean) {
    const res = await fetch(`/api/eval-configs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
    if (res.ok) {
      setConfigs(configs.map((c) => (c.id === id ? { ...c, enabled } : c)))
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/eval-configs/${id}`, { method: "DELETE" })
    if (res.ok) {
      setConfigs(configs.filter((c) => c.id !== id))
      toast.success("Scorer deleted")
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Custom Scorers</h2>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New Scorer
        </Button>
      </div>

      {configs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center">
          <div className="text-xs text-muted-foreground">No scorers configured yet.</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {configs.map((config) => (
            <div
              key={config.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              <button
                onClick={() => toggle(config.id, !config.enabled)}
                className={`h-4 w-7 rounded-full transition-colors relative ${
                  config.enabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                    config.enabled ? "left-3.5" : "left-0.5"
                  }`}
                />
              </button>
              <span className="text-sm font-medium">{config.scorerName}</span>
              <Badge
                variant="secondary"
                className={`text-[10px] ${TYPE_COLORS[config.type] ?? ""}`}
              >
                {TYPE_LABELS[config.type] ?? config.type}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {compNameMap.get(config.compositionId) ?? config.compositionId.slice(0, 8)}
              </span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {config.sampleRate}% sample · w{config.weight}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => remove(config.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Scorer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. instruction_following"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="llm_judge">LLM Judge</option>
                <option value="code">Code Expression</option>
                <option value="structured_output">Structured Output</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Composition</label>
              <select
                value={newCompId}
                onChange={(e) => setNewCompId(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="">Select...</option>
                {compositions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {newType === "llm_judge" && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Judge Model</label>
                  <Input
                    value={newJudgeModel}
                    onChange={(e) => setNewJudgeModel(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Judge Prompt (optional)</label>
                  <textarea
                    value={newJudgePrompt}
                    onChange={(e) => setNewJudgePrompt(e.target.value)}
                    placeholder="Custom judge prompt with {{input}}, {{output}}, {{systemPrompt}}"
                    rows={4}
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-xs font-mono resize-y"
                  />
                </div>
              </>
            )}
            {newType === "code" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Expression</label>
                <Input
                  value={newJudgePrompt}
                  onChange={(e) => setNewJudgePrompt(e.target.value)}
                  placeholder="e.g. outputLength > 100 ? 100 : outputLength"
                  className="font-mono"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Sample Rate (%)</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={newSampleRate}
                  onChange={(e) => setNewSampleRate(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Weight</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={newWeight}
                  onChange={(e) => setNewWeight(Number(e.target.value))}
                />
              </div>
            </div>
            <Button
              onClick={create}
              disabled={creating || !newName.trim() || !newCompId}
              className="w-full"
            >
              {creating ? "Creating..." : "Create Scorer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
