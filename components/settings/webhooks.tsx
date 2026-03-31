"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Globe } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

interface Webhook {
  id: string
  url: string
  events: string[]
  enabled: boolean
  secret: string | null
  createdAt: string
}

const ALL_EVENTS = [
  "block.created",
  "block.updated",
  "block.deleted",
  "composition.updated",
  "deployment.promoted",
  "deployment.review_requested",
]

export function WebhooksSection() {
  const [hooks, setHooks] = useState<Webhook[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [secret, setSecret] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch("/api/webhooks")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setHooks(data) })
  }, [])

  async function addWebhook() {
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        events: Array.from(selectedEvents),
        secret: secret || undefined,
      }),
    })
    if (res.ok) {
      const hook = await res.json()
      setHooks([...hooks, hook])
      setAddOpen(false)
      setUrl("")
      setSecret("")
      setSelectedEvents(new Set())
      toast.success("Webhook added")
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    const res = await fetch(`/api/webhooks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
    if (res.ok) {
      setHooks(hooks.map((h) => h.id === id ? { ...h, enabled } : h))
    }
  }

  async function deleteWebhook(id: string) {
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" })
    setHooks(hooks.filter((h) => h.id !== id))
    toast.success("Webhook deleted")
  }

  function toggleEvent(event: string) {
    setSelectedEvents((prev) => {
      const next = new Set(prev)
      if (next.has(event)) next.delete(event)
      else next.add(event)
      return next
    })
  }

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold mb-3">Webhooks</h2>
      <p className="text-xs text-muted-foreground mb-3">
        Get notified when events happen. POST requests are sent to your URL with event details.
      </p>

      <div className="space-y-2 mb-4">
        {hooks.map((h) => (
          <div key={h.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
            <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{h.url}</div>
              <div className="flex gap-1 mt-0.5 flex-wrap">
                {(h.events as string[]).map((e) => (
                  <span key={e} className="rounded bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
                    {e}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => toggleEnabled(h.id, !h.enabled)}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                h.enabled
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {h.enabled ? "Active" : "Paused"}
            </button>
            <Button
              size="sm" variant="ghost"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => deleteWebhook(h.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Add Webhook
      </Button>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">URL</label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Events</label>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {ALL_EVENTS.map((event) => (
                  <label key={event} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEvents.has(event)}
                      onChange={() => toggleEvent(event)}
                      className="rounded"
                    />
                    {event}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Secret (optional)</label>
              <Input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="HMAC signing secret"
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                If set, requests include an X-Composr-Signature header for verification.
              </p>
            </div>
            <Button onClick={addWebhook} disabled={!url.trim() || selectedEvents.size === 0} className="w-full">
              Add Webhook
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
