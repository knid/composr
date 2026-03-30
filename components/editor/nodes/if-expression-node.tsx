"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"

export function IfExpressionNode({ data }: NodeProps) {
  const { expression } = data as { expression: string }

  return (
    <div className="rounded-lg border-2 border-primary bg-primary/5 px-3 py-2 min-w-[160px] relative">
      <Handle type="target" position={Position.Left} className="!bg-primary !h-2 !w-2" />
      <div className="flex items-center gap-1.5 mb-1">
        <div className="flex h-4 w-4 items-center justify-center rounded bg-primary">
          <span className="text-[7px] font-bold text-white">EX</span>
        </div>
        <span className="text-[10px] font-semibold text-primary/80">Expression</span>
      </div>
      <code className="block mt-1 mb-1.5 rounded bg-background/50 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground break-all">
        {expression || "expression..."}
      </code>
      {/* True branch */}
      <div className="relative flex items-center gap-1.5 py-0.5">
        <div className="h-1.5 w-1.5 rounded-full bg-success" />
        <span className="text-[9px] text-success font-mono">true</span>
        <Handle
          type="source"
          position={Position.Right}
          id="true"
          className="!bg-success !h-2 !w-2 !right-[-12px]"
          style={{ top: "50%", position: "absolute", transform: "translateY(-50%)" }}
        />
      </div>
      {/* False branch */}
      <div className="relative flex items-center gap-1.5 py-0.5">
        <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
        <span className="text-[9px] text-destructive font-mono">false</span>
        <Handle
          type="source"
          position={Position.Right}
          id="false"
          className="!bg-destructive !h-2 !w-2 !right-[-12px]"
          style={{ top: "50%", position: "absolute", transform: "translateY(-50%)" }}
        />
      </div>
    </div>
  )
}
