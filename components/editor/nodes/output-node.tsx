"use client"

import { Handle, Position } from "@xyflow/react"

export function OutputNode() {
  return (
    <div className="rounded-lg border border-border bg-card px-3.5 py-2">
      {/* Accepts multiple incoming connections */}
      <Handle type="target" position={Position.Left} className="!bg-success !h-2 !w-2" isConnectable />
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-success" />
        <span className="text-xs font-semibold">Output</span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">Assembled prompt</p>
    </div>
  )
}
