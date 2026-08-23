'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_PALETTE } from '@/lib/chartColors'
import ChartTooltip from './ChartTooltip'
import { ChartEmptyState } from './ChartCard'

export interface DonutDatum {
  name: string
  value: number
  color?: string
}

export default function DonutChart({
  data,
  height = 200,
  centerLabel,
  emptyMessage = 'Sin datos todavía.',
}: {
  data: DonutDatum[]
  height?: number
  centerLabel?: string
  emptyMessage?: string
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return <ChartEmptyState message={emptyMessage} />

  return (
    <div>
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="92%" paddingAngle={data.length > 1 ? 3 : 0} strokeWidth={0}>
              {data.map((d, i) => (
                <Cell key={d.name} fill={d.color ?? CHART_PALETTE[i % CHART_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-2xl font-bold font-barlow tabular-nums" style={{ color: 'var(--dash-text)' }}>{total}</p>
          {centerLabel && <p className="text-[10px] uppercase tracking-wider text-center px-4" style={{ color: 'var(--dash-text-faint)' }}>{centerLabel}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-3">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color ?? CHART_PALETTE[i % CHART_PALETTE.length] }} />
            <span style={{ color: 'var(--dash-text-muted)' }}>{d.name}</span>
            <span className="font-semibold tabular-nums" style={{ color: 'var(--dash-text)' }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
