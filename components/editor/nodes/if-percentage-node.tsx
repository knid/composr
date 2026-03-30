"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"

interface IfPercentageData {
  variants: Array<{ name: string; weight: number }>
}

const variantColors = ["#4ade80", "#f59e0b", "#06b6d4", "#ec4899", "#8b5cf6"]

export function IfPercentageNode({ data }: NodeProps) {
  const { variants = [] } = data as IfPercentageData

  return (
    <div className="rounded-lg border-2 border-primary bg-primary/5 px-3 py-2 min-w-[150px]">
      <Handle type="target" position={Position.Left} className="!bg-primary !h-2 !w-2" />
      <div className="flex items-center gap-1.5 mb-1">
        <div className="flex h-4 w-4 items-center justify-center rounded bg-primary">
          <span className="text-[7px] font-bold text-white">%%</span>
        </div>
        <span className="text-[10px] font-semibold text-primary/80">A/B Split</span>
      </div>
      <div className="mt-1.5 flex flex-col gap-1">
        {variants.map((v, i) => (
          <div key={v.name} className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full" style={{ background: variantColors[i % variantColors.length] }} />
            <span className="text-[9px] font-mono text-muted-foreground">{v.weight}% → {v.name}</span>
          </div>
        ))}
      </div>
      {variants.map((v, i) => (
        <Handle key={v.name} type="source" position={Position.Right} id={v.name} className="!h-2 !w-2"
          style={{ top: `${35 + i * (50 / Math.max(variants.length, 1))}%`, background: variantColors[i % variantColors.length] }} />
      ))}
    </div>
  )
}
