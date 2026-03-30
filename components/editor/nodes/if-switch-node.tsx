"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"

const caseColors = ["#f59e0b", "#06b6d4", "#6b7280", "#ec4899", "#8b5cf6"]

export function IfSwitchNode({ data }: NodeProps) {
  const { field, cases = [] } = data as { field: string; cases: string[] }

  return (
    <div className="rounded-lg border-2 border-primary bg-primary/5 px-3 py-2 min-w-[150px] relative">
      <Handle type="target" position={Position.Left} className="!bg-primary !h-2 !w-2" />
      <div className="flex items-center gap-1.5 mb-1">
        <div className="flex h-4 w-4 items-center justify-center rounded bg-primary">
          <span className="text-[7px] font-bold text-white">SW</span>
        </div>
        <span className="text-[10px] font-semibold text-primary/80">Switch</span>
      </div>
      <div className="text-xs font-semibold text-foreground mb-1.5">{field || "field"}</div>
      {/* Each case gets an inline handle */}
      {cases.map((c: string, i: number) => (
        <div key={c} className="relative flex items-center gap-1.5 py-0.5">
          <div
            className="h-1.5 w-1.5 rounded-sm"
            style={{ background: caseColors[i % caseColors.length] }}
          />
          <span className="text-[8px] font-mono text-muted-foreground">== &quot;{c}&quot;</span>
          <Handle
            type="source"
            position={Position.Right}
            id={c}
            className="!h-2 !w-2 !right-[-12px]"
            style={{
              top: "50%",
              position: "absolute",
              transform: "translateY(-50%)",
              background: caseColors[i % caseColors.length],
            }}
          />
        </div>
      ))}
    </div>
  )
}
