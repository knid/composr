"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"

export function BlockNode({ data }: NodeProps) {
  const { label, tokenCount, description } = data as { label: string; blockId: string; tokenCount?: number; description?: string }

  return (
    <div className="rounded-lg border border-green-900/50 bg-green-950/30 px-3 py-2 min-w-[130px]">
      <Handle type="target" position={Position.Left} className="!bg-success !h-2 !w-2" />
      <div className="text-[9px] font-semibold text-success mb-0.5">BLOCK</div>
      <div className="text-xs font-medium text-foreground">{label}</div>
      {description && (
        <div className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">{description}</div>
      )}
      {tokenCount !== undefined && (
        <div className="text-[9px] font-mono text-muted-foreground mt-1">{tokenCount} tokens</div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-success !h-2 !w-2" />
    </div>
  )
}
