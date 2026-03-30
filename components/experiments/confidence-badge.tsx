import { cn } from "@/lib/utils"

interface ConfidenceBadgeProps {
  level: number
  status: "too_early" | "trending" | "significant"
}

export function ConfidenceBadge({ level, status }: ConfidenceBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium",
      status === "significant" && "bg-success/10 text-success",
      status === "trending" && "bg-warning/10 text-warning",
      status === "too_early" && "bg-muted text-muted-foreground",
    )}>
      {level}% confidence
    </span>
  )
}
