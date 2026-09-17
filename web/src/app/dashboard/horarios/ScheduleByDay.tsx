'use client'

import { useState } from 'react'

type Period = { id: string; name: string; start_time: string; end_time: string; sort_order: number; level: string | null }
type Slot = { day_of_week: number; period_id: string; subject: string | null; teacher: string | null }
export type ChildSchedule = { id: string; label: string; grade: string; periods: Period[]; slots: Slot[] }

const DAY_LABELS: Record<number, string> = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' }
const DAYS = [1, 2, 3, 4, 5, 6]

/**
 * Horario del día para familia/estudiante -- pensado para consultarse desde
 * el celular: elige el hijo (si hay más de uno) y el día, con el día de hoy
 * ya seleccionado al entrar. Todo con los datos que la página ya cargó, sin
 * ninguna consulta nueva al cambiar de hijo o de día.
 */
export default function ScheduleByDay({
  students,
  todayDow,
}: {
  students: ChildSchedule[]
  todayDow: number
}) {
  const [selectedChildId, setSelectedChildId] = useState(students[0]?.id ?? '')
  const [selectedDay, setSelectedDay] = useState(todayDow >= 1 && todayDow <= 6 ? todayDow : 1)

  const child = students.find((c) => c.id === selectedChildId) ?? students[0]
  if (!child) return null

  const daySlots = child.slots
    .filter((s) => s.day_of_week === selectedDay)
    .map((s) => ({ ...s, period: child.periods.find((p) => p.id === s.period_id) ?? null }))
    .sort((a, b) => (a.period?.sort_order ?? 0) - (b.period?.sort_order ?? 0))

  return (
    <div className="space-y-4">
      {students.length > 1 && (
        <div>
          <p className="text-xs font-semibold font-barlow uppercase tracking-wide mb-2" style={{ color: 'var(--dash-text-muted)' }}>
            Hijo/a
          </p>
          <div className="flex flex-wrap gap-2">
            {students.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedChildId(c.id)}
                className="rounded-full px-3.5 py-1.5 text-xs font-semibold font-barlow uppercase tracking-wide transition"
                style={
                  selectedChildId === c.id
                    ? { background: 'var(--dash-accent)', color: 'var(--dash-bg)' }
                    : { background: 'white', color: '#5f7a70', border: '1px solid #e2e8f0' }
                }
              >
                {c.label} · {c.grade}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold font-barlow uppercase tracking-wide mb-2" style={{ color: 'var(--dash-text-muted)' }}>
          Día
        </p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDay(d)}
              className="rounded-full px-3.5 py-1.5 text-xs font-semibold font-barlow uppercase tracking-wide transition"
              style={
                selectedDay === d
                  ? { background: 'var(--dash-accent)', color: 'var(--dash-bg)' }
                  : { background: 'white', color: '#5f7a70', border: '1px solid #e2e8f0' }
              }
            >
              {DAY_LABELS[d]}
              {d === todayDow ? ' · Hoy' : ''}
            </button>
          ))}
        </div>
        {todayDow === 0 && (
          <p className="text-xs mt-2" style={{ color: 'var(--dash-text-faint)' }}>
            Hoy es domingo, no hay clases. Mostrando el horario del lunes.
          </p>
        )}
      </div>

      {daySlots.length === 0 ? (
        <div className="dash-card border-dashed p-10 text-center">
          <p className="text-3xl mb-2" aria-hidden="true">🗓️</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
            {child.periods.length === 0
              ? 'Todavía no hay franjas horarias definidas para este curso.'
              : `Sin clases programadas para ${DAY_LABELS[selectedDay].toLowerCase()}.`}
          </p>
        </div>
      ) : (
        <div className="dash-card divide-y" style={{ borderColor: 'rgba(150,225,196,.08)' }}>
          {daySlots.map((s) => (
            <div key={`${s.day_of_week}-${s.period_id}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-xs whitespace-nowrap" style={{ color: 'var(--dash-text-faint)' }}>
                {s.period ? `${s.period.start_time.slice(0, 5)}–${s.period.end_time.slice(0, 5)}` : '—'}
              </span>
              <div className="flex-1 text-right">
                <p className="font-medium" style={{ color: 'var(--dash-text)' }}>{s.subject ?? '—'}</p>
                {s.teacher && <p className="text-xs" style={{ color: 'var(--dash-text-faint)' }}>{s.teacher}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
