"use client"

import { Handle, Position } from "@xyflow/react"

export function MergeNode() {
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2.5 min-w-[70px]">
      <Handle
        type="target"
        position={Position.Left}
        id="in-1"
        className="!bg-primary !h-2 !w-2"
        style={{ top: "30%" }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="in-2"
        className="!bg-primary !h-2 !w-2"
        style={{ top: "70%" }}
      />
      <span className="text-[9px] font-semibold text-primary/70">MERGE</span>
      <Handle type="source" position={Position.Right} className="!bg-primary !h-2 !w-2" />
    </div>
  )
}
