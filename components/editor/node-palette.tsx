"use client"

import { type DragEvent } from "react"
import { cn } from "@/lib/utils"
import {
  FileText, GitBranch, ToggleLeft, List, Percent, Code2, Merge, Layers, Wrench,
} from "lucide-react"

interface PaletteItem {
  type: string
  label: string
  icon: React.ReactNode
  color: string
  description: string
}

const paletteItems: PaletteItem[] = [
  {
    type: "block",
    label: "Block",
    icon: <FileText className="h-3.5 w-3.5" />,
    color: "text-green-400 bg-green-400/10 border-green-400/20",
    description: "Prompt content block",
  },
  {
    type: "tool",
    label: "Tool",
    icon: <Wrench className="h-3.5 w-3.5" />,
    color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    description: "Function calling def",
  },
  {
    type: "ifBoolean",
    label: "IF Boolean",
    icon: <ToggleLeft className="h-3.5 w-3.5" />,
    color: "text-primary bg-primary/10 border-primary/20",
    description: "Branch on true/false",
  },
  {
    type: "ifSwitch",
    label: "IF Switch",
    icon: <List className="h-3.5 w-3.5" />,
    color: "text-primary bg-primary/10 border-primary/20",
    description: "Branch on value match",
  },
  {
    type: "ifPercentage",
    label: "IF Percentage",
    icon: <Percent className="h-3.5 w-3.5" />,
    color: "text-primary bg-primary/10 border-primary/20",
    description: "A/B split by weight",
  },
  {
    type: "ifExpression",
    label: "IF Expression",
    icon: <Code2 className="h-3.5 w-3.5" />,
    color: "text-primary bg-primary/10 border-primary/20",
    description: "Branch on expression",
  },
  {
    type: "compositionRef",
    label: "Comp Ref",
    icon: <Layers className="h-3.5 w-3.5" />,
    color: "text-primary bg-primary/10 border-primary/20",
    description: "Include another composition",
  },
  {
    type: "merge",
    label: "Merge",
    icon: <Merge className="h-3.5 w-3.5" />,
    color: "text-primary bg-primary/10 border-primary/20",
    description: "Join branches",
  },
]

function onDragStart(event: DragEvent<HTMLDivElement>, nodeType: string) {
  event.dataTransfer.setData("application/reactflow", nodeType)
  event.dataTransfer.effectAllowed = "move"
}

export function NodePalette() {
  return (
    <div className="flex h-full w-[148px] flex-col border-r border-border bg-card/50">
      <div className="px-3 py-2.5 border-b border-border">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Nodes
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {paletteItems.map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => onDragStart(e, item.type)}
            className={cn(
              "group cursor-grab rounded-md border px-2.5 py-2 transition-all active:cursor-grabbing",
              "hover:border-foreground/20 hover:bg-accent/50",
              item.color
            )}
          >
            <div className="flex items-center gap-1.5">
              {item.icon}
              <span className="text-[11px] font-medium">{item.label}</span>
            </div>
            <p className="mt-0.5 text-[9px] text-muted-foreground leading-tight">
              {item.description}
            </p>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-3 py-2">
        <p className="text-[9px] text-muted-foreground italic leading-tight">
          Drag a node onto the canvas to add it to the flow.
        </p>
      </div>
    </div>
  )
}
