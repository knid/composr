"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

interface ProviderKey {
  id: string
  provider: string
  keyPrefix: string
  createdAt: string
}

const PROVIDER_INFO: Record<string, { label: string; color: string; placeholder: string }> = {
  anthropic: { label: "Anthropic", color: "bg-amber-600", placeholder: "sk-ant-..." },
  openai: { label: "OpenAI", color: "bg-emerald-600", placeholder: "sk-proj-..." },
}

export function ProviderKeysSection() {
  const [keys, setKeys] = useState<ProviderKey[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [provider, setProvider] = useState("anthropic")
  const [apiKey, setApiKey] = useState("")

  useEffect(() => {
    fetch("/api/provider-keys")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setKeys(data) })
  }, [])

  async function addKey() {
    const res = await fetch("/api/provider-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey }),
    })
    if (res.ok) {
      const key = await res.json()
      setKeys([...keys, key])
      setAddOpen(false)
      setApiKey("")
      toast.success(`${PROVIDER_INFO[provider].label} key added`)
    } else {
      const data = await res.json()
      toast.error(data.error ?? "Failed to add key")
    }
  }

  async function deleteKey(id: string) {
    await fetch(`/api/provider-keys/${id}`, { method: "DELETE" })
    setKeys(keys.filter((k) => k.id !== id))
    toast.success("Provider key deleted")
  }

  const connectedProviders = new Set(keys.map((k) => k.provider))

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold mb-3">LLM Providers</h2>
      <p className="text-xs text-muted-foreground mb-3">
        Add your provider API keys to use the playground and configure models per composition.
      </p>

      <div className="space-y-2 mb-4">
        {keys.map((k) => {
          const info = PROVIDER_INFO[k.provider] ?? { label: k.provider, color: "bg-gray-600" }
          return (
            <div key={k.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <div className={`h-6 w-6 rounded ${info.color} flex items-center justify-center text-[10px] font-bold text-white`}>
                {info.label[0]}
              </div>
              <span className="text-sm font-medium">{info.label}</span>
              <code className="font-mono text-xs text-muted-foreground">{k.keyPrefix}</code>
              <span className="ml-auto rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-500">
                Connected
              </span>
              <Button
                size="sm" variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => deleteKey(k.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )
        })}
      </div>

      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Add Provider
      </Button>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add LLM Provider</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm mt-1"
              >
                {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                  <option key={key} value={key} disabled={connectedProviders.has(key)}>
                    {info.label} {connectedProviders.has(key) ? "(already added)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">API Key</label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={PROVIDER_INFO[provider]?.placeholder ?? "API key"}
                className="mt-1"
              />
            </div>
            <Button onClick={addKey} disabled={!apiKey.trim()} className="w-full">
              Add Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
