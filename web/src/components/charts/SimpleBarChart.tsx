'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { CHART_PALETTE, CHART_AXIS_COLOR, CHART_GRID_COLOR } from '@/lib/chartColors'
import ChartTooltip from './ChartTooltip'
import { ChartEmptyState } from './ChartCard'

export interface BarDatum {
  name: string
  value: number
  color?: string
}

export default function SimpleBarChart({
  data,
  height = 220,
  horizontal = false,
  valueFormatter,
  emptyMessage = 'Sin datos todavía.',
  singleColor,
}: {
  data: BarDatum[]
  height?: number
  horizontal?: boolean
  valueFormatter?: (v: number) => string
  emptyMessage?: string
  singleColor?: string
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) return <ChartEmptyState message={emptyMessage} />

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} horizontal={!horizontal} vertical={horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} tickFormatter={valueFormatter} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} width={90} axisLine={false} tickLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} tickFormatter={valueFormatter} axisLine={false} tickLine={false} width={40} />
            </>
          )}
          <Tooltip cursor={{ fill: CHART_GRID_COLOR }} content={<ChartTooltip formatter={(v) => (valueFormatter ? valueFormatter(Number(v)) : String(v))} />} />
          <Bar dataKey="value" radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={40}>
            {data.map((d, i) => (
              <Cell key={d.name} fill={d.color ?? singleColor ?? CHART_PALETTE[i % CHART_PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
