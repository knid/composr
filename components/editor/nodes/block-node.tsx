"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"

const ROLE_COLORS: Record<string, string> = {
  system: "bg-blue-500/20 text-blue-400",
  user: "bg-amber-500/20 text-amber-400",
  assistant: "bg-purple-500/20 text-purple-400",
}

export function BlockNode({ data }: NodeProps) {
  const { label, tokenCount, description, role } = data as {
    label: string
    blockId: string
    tokenCount?: number
    description?: string
    role?: string | null
  }

  const displayRole = role || "system"

  return (
    <div className="rounded-lg border border-green-900/50 bg-green-950/30 px-3 py-2 min-w-[130px]">
      <Handle type="target" position={Position.Left} className="!bg-success !h-2 !w-2" />
      <div className="flex items-center gap-1.5 mb-0.5">
        <div className="text-[9px] font-semibold text-success">BLOCK</div>
        <span className={cn("rounded px-1 py-px text-[8px] font-medium uppercase", ROLE_COLORS[displayRole] ?? ROLE_COLORS.system)}>
          {displayRole}
        </span>
      </div>
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
