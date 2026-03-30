"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

interface LineChartCardProps {
  title: string
  data: Array<{ label: string; value: number }>
  color?: string
  valueFormatter?: (v: number) => string
}

export function LineChartCard({ title, data, color = "#7c3aed", valueFormatter }: LineChartCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-xs font-semibold text-muted-foreground mb-3">{title}</h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} width={40} tickFormatter={valueFormatter} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontSize: "11px", color: "#e4e4e7" }} formatter={(value: number) => [valueFormatter ? valueFormatter(value) : value]} />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
