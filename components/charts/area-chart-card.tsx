"use client"

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

interface AreaChartCardProps {
  title: string
  data: Array<{ label: string; value: number }>
  color?: string
}

export function AreaChartCard({ title, data, color = "#3b82f6" }: AreaChartCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-xs font-semibold text-muted-foreground mb-3">{title}</h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} width={40} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontSize: "11px", color: "#e4e4e7" }} />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#gradient-${title})`} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
