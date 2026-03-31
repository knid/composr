"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"

export function ToolNode({ data }: NodeProps) {
  const { label, paramCount } = data as {
    label: string
    blockId: string
    paramCount?: number
  }

  return (
    <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 min-w-[130px]">
      <Handle type="target" position={Position.Left} className="!bg-amber-500 !h-2 !w-2" />
      <div className="flex items-center gap-1.5 mb-0.5">
        <div className="text-[9px] font-semibold text-amber-500">TOOL</div>
      </div>
      <div className="text-xs font-medium text-foreground">{label}</div>
      {paramCount !== undefined && paramCount > 0 && (
        <div className="text-[9px] font-mono text-muted-foreground mt-1">{paramCount} params</div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-amber-500 !h-2 !w-2" />
    </div>
  )
}
