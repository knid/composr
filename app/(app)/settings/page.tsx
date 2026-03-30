"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Key, Copy, Plus } from "lucide-react"
import { toast } from "sonner"

export default function SettingsPage() {
  const [keys, setKeys] = useState<any[]>([])
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyEnv, setNewKeyEnv] = useState("dev")
  const [revealedKey, setRevealedKey] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/api-keys").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setKeys(data) })
  }, [])

  async function createKey() {
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName, environment: newKeyEnv }),
    })
    const data = await res.json()
    setRevealedKey(data.key)
    setNewKeyName("")
    fetch("/api/api-keys").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setKeys(data) })
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold tracking-tight mb-4">Settings</h1>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-3">API Keys</h2>

        {revealedKey && (
          <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3">
            <p className="text-xs text-warning font-medium mb-1">Copy this key — it won&apos;t be shown again:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-background px-2 py-1 font-mono text-xs break-all">{revealedKey}</code>
              <Button size="sm" variant="ghost"
                onClick={() => { navigator.clipboard.writeText(revealedKey); toast.success("Copied!") }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2 mb-4">
          {keys.map((k: any) => (
            <div key={k.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <Key className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">{k.name}</span>
              <code className="font-mono text-xs text-muted-foreground">{k.keyPrefix}</code>
              <span className="ml-auto rounded bg-secondary px-2 py-0.5 text-[10px]">{k.environment}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input placeholder="Key name" value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)} className="w-48" />
          <select value={newKeyEnv} onChange={(e) => setNewKeyEnv(e.target.value)}
            className="rounded border border-border bg-background px-2 py-1.5 text-sm">
            <option value="dev">dev</option>
            <option value="staging">staging</option>
            <option value="prod">prod</option>
          </select>
          <Button size="sm" onClick={createKey} disabled={!newKeyName.trim()} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Create Key
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3">SDK Quick Start</h2>
        <pre className="rounded-lg border border-border bg-card p-4 font-mono text-xs text-muted-foreground overflow-x-auto">
{`npm install @composr/sdk

import { Composr } from '@composr/sdk'

const pk = new Composr({
  apiKey: 'pk_live_...',
  environment: 'prod'
})

const result = await pk.compose('builder', {
  projectType: 'ecommerce',
  hasAuth: true
})

console.log(result.text) // assembled prompt`}
        </pre>
      </section>
    </div>
  )
}
