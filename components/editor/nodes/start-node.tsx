"use client"

import { Handle, Position } from "@xyflow/react"

export function StartNode() {
  return (
    <div className="rounded-lg border border-border bg-card px-3.5 py-2">
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <span className="text-xs font-semibold">Start</span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">Context input</p>
      <Handle type="source" position={Position.Right} className="!bg-primary !h-2 !w-2" />
    </div>
  )
}
