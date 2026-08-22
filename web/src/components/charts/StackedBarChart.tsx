'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { CHART_PALETTE, CHART_AXIS_COLOR, CHART_GRID_COLOR } from '@/lib/chartColors'
import ChartTooltip from './ChartTooltip'
import { ChartEmptyState } from './ChartCard'
import { resolveValueFormatter, type ValueFormat } from './valueFormat'

export interface StackedSeries {
  key: string
  label: string
  color?: string
}

export default function StackedBarChart({
  data,
  series,
  height = 260,
  horizontal = true,
  valueFormat,
  emptyMessage = 'Sin datos todavía.',
}: {
  data: Record<string, string | number>[]
  series: StackedSeries[]
  height?: number
  horizontal?: boolean
  valueFormat?: ValueFormat
  emptyMessage?: string
}) {
  const valueFormatter = resolveValueFormatter(valueFormat)
  const hasData = data.length > 0 && data.some((row) => series.some((s) => Number(row[s.key]) > 0))
  if (!hasData) return <ChartEmptyState message={emptyMessage} />

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} horizontal={!horizontal} vertical={horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} tickFormatter={valueFormatter} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} width={110} axisLine={false} tickLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} tickFormatter={valueFormatter} axisLine={false} tickLine={false} width={40} />
            </>
          )}
          <Tooltip cursor={{ fill: CHART_GRID_COLOR }} content={<ChartTooltip formatter={(v) => (valueFormatter ? valueFormatter(Number(v)) : String(v))} />} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="total"
              fill={s.color ?? CHART_PALETTE[i % CHART_PALETTE.length]}
              radius={i === series.length - 1 ? (horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]) : 0}
              maxBarSize={32}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
