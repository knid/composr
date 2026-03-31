import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { ConfidenceBadge } from "./confidence-badge"

interface Variant {
  id: string
  name: string
  sampleSize: number
  meanScore: number
  isWinner: boolean
}

interface ExperimentCardProps {
  compositionId: string
  compositionName: string
  durationDays: number
  confidenceLevel: number
  status: "too_early" | "trending" | "significant"
  variants: Variant[]
}

export function ExperimentCard({
  compositionId,
  compositionName,
  durationDays,
  confidenceLevel,
  status,
  variants,
}: ExperimentCardProps) {
  const winner = status === "significant" ? variants.find((v) => v.isWinner) : null

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-sm font-medium">{compositionName}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {durationDays === 1 ? "1 day" : `${durationDays} days`}
          </div>
        </div>
        <ConfidenceBadge level={confidenceLevel} status={status} />
      </div>

      <div className="space-y-2">
        {variants.map((variant) => (
          <div
            key={variant.id}
            className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{variant.name}</span>
              {variant.isWinner && status === "significant" && (
                <span className="rounded px-1.5 py-0.5 bg-success/10 text-success text-[10px] font-medium">
                  winner
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>{variant.sampleSize} samples</span>
              <span className="font-medium text-foreground tabular-nums">
                {variant.meanScore.toFixed(1)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {winner && (
        <div className="mt-3 rounded-md border border-success/20 bg-success/5 px-3 py-2">
          <div className="text-[11px] text-success">
            <span className="font-semibold">{winner.name}</span> is the statistically significant winner at {confidenceLevel}% confidence.
          </div>
          <Link
            href={`/compositions/${compositionId}`}
            className="mt-2 inline-flex items-center gap-1 rounded-md bg-success/10 px-2.5 py-1 text-[10px] font-medium text-success hover:bg-success/20 transition-colors"
          >
            Promote Winner <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  )
}
