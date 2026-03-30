interface StatCardProps {
  label: string
  value: string | number
  detail?: string
  detailColor?: "success" | "warning" | "muted"
}

export function StatCard({ label, value, detail, detailColor = "muted" }: StatCardProps) {
  const colorMap = {
    success: "text-success",
    warning: "text-warning",
    muted: "text-muted-foreground",
  }
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {detail && <div className={`mt-0.5 text-[10px] ${colorMap[detailColor]}`}>{detail}</div>}
    </div>
  )
}
