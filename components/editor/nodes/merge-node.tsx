"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"

export function MergeNode({ data }: NodeProps) {
  const inputCount = (data as any).inputCount ?? 2
  const handles = Array.from({ length: inputCount }, (_, i) => i)

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2.5 min-w-[70px]">
      {handles.map((i) => (
        <Handle
          key={`in-${i + 1}`}
          type="target"
          position={Position.Left}
          id={`in-${i + 1}`}
          className="!bg-primary !h-2 !w-2"
          style={{ top: `${((i + 1) / (inputCount + 1)) * 100}%` }}
        />
      ))}
      <span className="text-[9px] font-semibold text-primary/70">MERGE</span>
      <Handle type="source" position={Position.Right} className="!bg-primary !h-2 !w-2" />
    </div>
  )
}
