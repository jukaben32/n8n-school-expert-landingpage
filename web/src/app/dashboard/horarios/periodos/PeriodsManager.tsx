'use client'

import { useState } from 'react'
import { createPeriodAction, deletePeriodAction } from './actions'

interface Period {
  id: string
  name: string
  start_time: string
  end_time: string
  sort_order: number
  level: string | null
}

/** Mismos valores que `grade_levels.category` y el check de `class_periods.level`. */
const LEVEL_OPTIONS = [
  { value: '', label: 'Todos los niveles' },
  { value: 'parvulo', label: 'Párvulo' },
  { value: 'inicial', label: 'Inicial' },
  { value: 'primaria', label: 'Primaria' },
  { value: 'secundaria', label: 'Secundaria' },
]

const LEVEL_LABELS: Record<string, string> = {
  parvulo: 'Párvulo',
  inicial: 'Inicial',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'

export default function PeriodsManager({ initial, nextSortOrder }: { initial: Period[]; nextSortOrder: number }) {
  const [periods, setPeriods] = useState(initial)
  const [name, setName] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [level, setLevel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    setError(null)
    if (!name.trim() || !startTime || !endTime) {
      setError('Completa nombre, hora de inicio y hora de fin.')
      return
    }
    setSaving(true)
    const result = await createPeriodAction(name, startTime, endTime, nextSortOrder + periods.length, level)
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo crear la franja.')
      return
    }
    setPeriods((prev) => [...prev, { id: `temp-${Date.now()}`, name: name.trim(), start_time: startTime, end_time: endTime, sort_order: nextSortOrder + prev.length, level: level || null }])
    setName('')
    setStartTime('')
    setEndTime('')
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Borrar esta franja horaria? También se borrará el horario asignado en ella.')) return
    setPeriods((prev) => prev.filter((p) => p.id !== id))
    await deletePeriodAction(id)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/50">
        {periods.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 dark:text-slate-500 text-center">Todavía no hay franjas horarias.</p>
        ) : (
          periods.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-slate-900 dark:text-white">{p.name}</p>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {p.level ? LEVEL_LABELS[p.level] ?? p.level : 'Todos'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{p.start_time.slice(0, 5)} – {p.end_time.slice(0, 5)}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                className="text-xs text-red-500 hover:text-red-600 font-semibold"
              >
                Borrar
              </button>
            </div>
          ))
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Agregar franja</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Período 1" className={inputClass} />
        <div className="grid grid-cols-2 gap-3">
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="period-level" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
            Nivel
          </label>
          <select id="period-level" value={level} onChange={(e) => setLevel(e.target.value)} className={inputClass}>
            {LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving}
          className="w-full rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 text-sm transition disabled:opacity-60"
        >
          {saving ? 'Agregando...' : 'Agregar franja'}
        </button>
      </div>
    </div>
  )
}
