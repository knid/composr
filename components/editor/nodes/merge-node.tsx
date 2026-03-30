"use client"

import { Handle, Position } from "@xyflow/react"

export function MergeNode() {
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-primary !h-2 !w-2"
        isConnectable
      />
      <span className="text-[9px] font-semibold text-primary/70">MERGE</span>
      <Handle type="source" position={Position.Right} className="!bg-primary !h-2 !w-2" />
    </div>
  )
}
