"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { GitBranch } from "lucide-react"

export function CompositionRefNode({ data }: NodeProps) {
  const { compositionName } = data as {
    compositionId?: string
    compositionName?: string
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 min-w-[140px]">
      <Handle type="target" position={Position.Left} className="!bg-primary !h-2 !w-2" />
      <div className="flex items-center gap-1.5 mb-0.5">
        <GitBranch className="h-3 w-3 text-primary/70" />
        <div className="text-[9px] font-semibold text-primary">COMPOSITION</div>
      </div>
      <div className="text-xs font-medium text-foreground">
        {compositionName || "Select..."}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary !h-2 !w-2" />
    </div>
  )
}
