"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Play } from "lucide-react"
import { toast } from "sonner"

export function RunEvalButton({ scoreId, evalStatus }: { scoreId: string; evalStatus: string }) {
  const [running, setRunning] = useState(false)

  if (evalStatus === "completed") return null

  async function run() {
    setRunning(true)
    const res = await fetch("/api/eval/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoreId }),
    })
    const data = await res.json()
    if (data.status === "completed") {
      toast.success(`Eval complete — score: ${data.overallScore ?? "n/a"}`)
    } else if (data.status === "skipped") {
      toast("Eval skipped — no configs found")
    } else {
      toast.error("Eval failed")
    }
    setRunning(false)
  }

  return (
    <Button size="sm" variant="ghost" className="h-6 gap-1 px-1.5 text-[10px]"
      onClick={run} disabled={running}>
      <Play className="h-3 w-3" />
      {running ? "..." : "Run"}
    </Button>
  )
}
