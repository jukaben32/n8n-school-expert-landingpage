'use client'

import { useState } from 'react'
import { setScheduleSlotAction } from './actions'

interface Period {
  id: string
  name: string
  start_time: string
  end_time: string
}
interface SlotValue {
  day_of_week: number
  period_id: string
  subject_id: string | null
  staff_id: string | null
}
interface NamedOption {
  id: string
  name?: string
  first_name?: string
  last_name?: string
}

function slotKey(day: number, periodId: string) {
  return `${day}-${periodId}`
}

/**
 * Grilla editable del horario de un curso -- una fila por franja horaria,
 * una columna por día. Cada celda tiene dos selects (materia, profesor)
 * que guardan automáticamente al cambiar, sin botón "Guardar" aparte.
 */
export default function ScheduleGrid({
  gradeLevel,
  periods,
  days,
  dayLabels,
  initialSlots,
  subjects,
  teachers,
}: {
  gradeLevel: string
  periods: Period[]
  days: number[]
  dayLabels: Record<number, string>
  initialSlots: SlotValue[]
  subjects: NamedOption[]
  teachers: NamedOption[]
}) {
  const [slots, setSlots] = useState<Map<string, { subjectId: string; staffId: string }>>(
    new Map(initialSlots.map((s) => [slotKey(s.day_of_week, s.period_id), { subjectId: s.subject_id ?? '', staffId: s.staff_id ?? '' }]))
  )
  const [savingKey, setSavingKey] = useState<string | null>(null)

  async function handleChange(day: number, periodId: string, field: 'subjectId' | 'staffId', value: string) {
    const key = slotKey(day, periodId)
    const current = slots.get(key) ?? { subjectId: '', staffId: '' }
    const next = { ...current, [field]: value }
    setSlots((prev) => new Map(prev).set(key, next))
    setSavingKey(key)
    await setScheduleSlotAction(gradeLevel, day, periodId, next.subjectId, next.staffId)
    setSavingKey(null)
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-slate-50 dark:bg-slate-800/50">
          <tr>
            <th className="px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">Hora</th>
            {days.map((d) => (
              <th key={d} className="px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">{dayLabels[d]}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
          {periods.map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap align-top">
                {p.name}<br />{p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}
              </td>
              {days.map((d) => {
                const key = slotKey(d, p.id)
                const value = slots.get(key) ?? { subjectId: '', staffId: '' }
                const busy = savingKey === key
                return (
                  <td key={d} className="px-2 py-2 align-top min-w-[140px]">
                    <select
                      value={value.subjectId}
                      onChange={(e) => handleChange(d, p.id, 'subjectId', e.target.value)}
                      disabled={busy}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 mb-1 disabled:opacity-50"
                    >
                      <option value="">Sin materia</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <select
                      value={value.staffId}
                      onChange={(e) => handleChange(d, p.id, 'staffId', e.target.value)}
                      disabled={busy}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 disabled:opacity-50"
                    >
                      <option value="">Sin profesor</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                      ))}
                    </select>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
