"use client"

import { Handle, Position } from "@xyflow/react"

export function MergeNode() {
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 min-w-[80px]">
      {/* Single target handle that accepts unlimited connections */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-primary !h-3 !w-3 !rounded-sm"
        isConnectable
      />
      <div className="text-center">
        <span className="text-[9px] font-semibold text-primary/70">MERGE</span>
        <div className="text-[7px] text-muted-foreground">joins branches</div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary !h-2 !w-2" />
    </div>
  )
}
