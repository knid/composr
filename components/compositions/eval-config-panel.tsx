"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Trash2, Plus } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

interface EvalConfig {
  id: string
  compositionId: string
  scorerName: string
  enabled: boolean
  sampleRate: number
  judgeModel: string
  judgePrompt: string | null
  weight: number
}

interface EvalConfigPanelProps {
  compositionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EvalConfigPanel({ compositionId, open, onOpenChange }: EvalConfigPanelProps) {
  const [configs, setConfigs] = useState<EvalConfig[]>([])
  const [loading, setLoading] = useState(false)

  // New config form
  const [newScorer, setNewScorer] = useState("")
  const [newSampleRate, setNewSampleRate] = useState(20)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(`/api/eval-configs?compositionId=${compositionId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setConfigs(data) })
      .finally(() => setLoading(false))
  }, [open, compositionId])

  async function addConfig() {
    setAdding(true)
    const res = await fetch("/api/eval-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compositionId, scorerName: newScorer, sampleRate: newSampleRate }),
    })
    if (res.ok) {
      const config = await res.json()
      setConfigs([...configs, config])
      setNewScorer("")
      setNewSampleRate(20)
      toast.success("Eval config added")
    }
    setAdding(false)
  }

  async function toggleEnabled(config: EvalConfig) {
    const res = await fetch(`/api/eval-configs/${config.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !config.enabled }),
    })
    if (res.ok) {
      const updated = await res.json()
      setConfigs(configs.map((c) => (c.id === config.id ? updated : c)))
    }
  }

  async function updateConfig(id: string, field: string, value: unknown) {
    const res = await fetch(`/api/eval-configs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    })
    if (res.ok) {
      const updated = await res.json()
      setConfigs(configs.map((c) => (c.id === id ? updated : c)))
    }
  }

  async function deleteConfig(id: string) {
    const res = await fetch(`/api/eval-configs/${id}`, { method: "DELETE" })
    if (res.ok) {
      setConfigs(configs.filter((c) => c.id !== id))
      toast.success("Eval config deleted")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Eval Configs</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-3">
            {configs.length === 0 && (
              <p className="text-sm text-muted-foreground">No eval configs yet. Add one below.</p>
            )}

            {configs.map((config) => (
              <div key={config.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch checked={config.enabled} onCheckedChange={() => toggleEnabled(config)} />
                    <span className="text-sm font-medium">{config.scorerName}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteConfig(config.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <label className="text-muted-foreground">Sample %</label>
                  <Input type="number" value={config.sampleRate} className="w-20 h-7 text-xs"
                    onChange={(e) => updateConfig(config.id, "sampleRate", parseInt(e.target.value) || 0)}
                    onBlur={(e) => updateConfig(config.id, "sampleRate", parseInt(e.target.value) || 0)} />
                  <label className="text-muted-foreground">Weight</label>
                  <Input type="number" value={config.weight} className="w-16 h-7 text-xs"
                    onChange={(e) => updateConfig(config.id, "weight", parseInt(e.target.value) || 1)}
                    onBlur={(e) => updateConfig(config.id, "weight", parseInt(e.target.value) || 1)} />
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">{config.judgeModel}</div>
              </div>
            ))}

            {/* Add new config */}
            <div className="border-t border-border pt-3">
              <div className="flex items-center gap-2">
                <Input placeholder="Scorer name (e.g. relevance, coherence)"
                  value={newScorer} onChange={(e) => setNewScorer(e.target.value)}
                  className="flex-1" />
                <Input type="number" placeholder="%" value={newSampleRate}
                  onChange={(e) => setNewSampleRate(parseInt(e.target.value) || 0)}
                  className="w-20" />
                <Button size="sm" className="gap-1.5" onClick={addConfig}
                  disabled={!newScorer.trim() || adding}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
