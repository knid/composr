"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"

export function IfBooleanNode({ data }: NodeProps) {
  const { field } = data as { field: string }

  return (
    <div className="rounded-lg border-2 border-primary bg-primary/5 px-3 py-2 min-w-[130px] relative">
      <Handle type="target" position={Position.Left} className="!bg-primary !h-2 !w-2" />
      <div className="flex items-center gap-1.5 mb-1">
        <div className="flex h-4 w-4 items-center justify-center rounded bg-primary">
          <span className="text-[8px] font-bold text-white">IF</span>
        </div>
        <span className="text-[10px] font-semibold text-primary/80">Boolean</span>
      </div>
      <div className="text-xs font-semibold text-foreground mb-1.5">{field || "field"}</div>
      {/* True branch — handle is inline with the label */}
      <div className="relative flex items-center gap-1.5 py-0.5">
        <div className="h-1.5 w-1.5 rounded-full bg-success" />
        <span className="text-[9px] text-success font-mono">== true</span>
        <Handle
          type="source"
          position={Position.Right}
          id="true"
          className="!bg-success !h-2 !w-2 !right-[-12px]"
          style={{ top: "50%", position: "absolute", transform: "translateY(-50%)" }}
        />
      </div>
      {/* False branch — handle is inline with the label */}
      <div className="relative flex items-center gap-1.5 py-0.5">
        <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
        <span className="text-[9px] text-destructive font-mono">== false</span>
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
