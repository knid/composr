// components/editor/version-diff.tsx
"use client"

import { cn } from "@/lib/utils"
import type { DiffLine } from "@/lib/diff"

interface VersionDiffProps {
  diff: DiffLine[]
  leftLabel: string
  rightLabel: string
}

export function VersionDiff({ diff, leftLabel, rightLabel }: VersionDiffProps) {
  const leftLines: Array<{ num: number | null; text: string; type: DiffLine["type"] }> = []
  const rightLines: Array<{ num: number | null; text: string; type: DiffLine["type"] }> = []

  let leftNum = 0
  let rightNum = 0

  for (const line of diff) {
    if (line.type === "unchanged") {
      leftNum++
      rightNum++
      leftLines.push({ num: leftNum, text: line.text, type: "unchanged" })
      rightLines.push({ num: rightNum, text: line.text, type: "unchanged" })
    } else if (line.type === "removed") {
      leftNum++
      leftLines.push({ num: leftNum, text: line.text, type: "removed" })
      rightLines.push({ num: null, text: "", type: "removed" })
    } else {
      rightNum++
      leftLines.push({ num: null, text: "", type: "added" })
      rightLines.push({ num: rightNum, text: line.text, type: "added" })
    }
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex border-b border-border text-[10px] font-medium text-muted-foreground">
        <div className="flex-1 px-3 py-1.5 border-r border-border bg-red-500/5">{leftLabel}</div>
        <div className="flex-1 px-3 py-1.5 bg-green-500/5">{rightLabel}</div>
      </div>
      <div className="flex max-h-[300px] overflow-y-auto">
        <div className="flex-1 border-r border-border">
          {leftLines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "flex font-mono text-[11px] leading-5 min-h-[20px]",
                line.type === "removed" && "bg-red-500/10",
              )}
            >
              <span className="w-8 text-right pr-2 text-muted-foreground/50 select-none shrink-0">
                {line.num ?? ""}
              </span>
              <span className={cn(
                "flex-1 px-2 whitespace-pre-wrap break-all",
                line.type === "removed" && "text-red-400",
                line.type === "added" && "text-transparent",
              )}>
                {line.text}
              </span>
            </div>
          ))}
        </div>
        <div className="flex-1">
          {rightLines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "flex font-mono text-[11px] leading-5 min-h-[20px]",
                line.type === "added" && "bg-green-500/10",
              )}
            >
              <span className="w-8 text-right pr-2 text-muted-foreground/50 select-none shrink-0">
                {line.num ?? ""}
              </span>
              <span className={cn(
                "flex-1 px-2 whitespace-pre-wrap break-all",
                line.type === "added" && "text-green-400",
                line.type === "removed" && "text-transparent",
              )}>
                {line.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
