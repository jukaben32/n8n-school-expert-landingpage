'use client'

// Tooltip compartido para todos los gráficos -- se renderiza como un div
// normal (no SVG), así que sí puede usar clases `dark:` de Tailwind, a
// diferencia del resto de las formas de Recharts.
export default function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: { name?: string; value?: number | string; color?: string; dataKey?: string | number }[]
  label?: string
  formatter?: (value: number | string, name: string) => string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-slate-500 dark:text-slate-400">{p.name}:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {formatter && p.value !== undefined ? formatter(p.value, p.name ?? '') : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}
