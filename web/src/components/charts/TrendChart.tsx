'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { CHART_PALETTE, CHART_AXIS_COLOR, CHART_GRID_COLOR } from '@/lib/chartColors'
import ChartTooltip from './ChartTooltip'
import { ChartEmptyState } from './ChartCard'
import { resolveValueFormatter, type ValueFormat } from './valueFormat'

export interface TrendSeries {
  key: string
  label: string
  color?: string
}

export default function TrendChart({
  data,
  series,
  height = 220,
  valueFormat,
  emptyMessage = 'Sin datos todavía.',
}: {
  data: Record<string, string | number>[]
  series: TrendSeries[]
  height?: number
  valueFormat?: ValueFormat
  emptyMessage?: string
}) {
  const valueFormatter = resolveValueFormatter(valueFormat)
  const hasData = data.length > 0 && data.some((row) => series.some((s) => Number(row[s.key]) > 0))
  if (!hasData) return <ChartEmptyState message={emptyMessage} />

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s, i) => {
              const color = s.color ?? CHART_PALETTE[i % CHART_PALETTE.length]
              return (
                <linearGradient key={s.key} id={`trend-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              )
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} tickFormatter={valueFormatter} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<ChartTooltip formatter={(v) => (valueFormatter ? valueFormatter(Number(v)) : String(v))} />} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />}
          {series.map((s, i) => {
            const color = s.color ?? CHART_PALETTE[i % CHART_PALETTE.length]
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={color}
                strokeWidth={2}
                fill={`url(#trend-fill-${s.key})`}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
