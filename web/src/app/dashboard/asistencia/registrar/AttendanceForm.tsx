'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DateInputES from '@/components/DateInputES'

type AttendanceStatus = 'presente' | 'ausente' | 'tardanza' | 'justificado'

interface Student { id: string; first_name: string; last_name: string }

interface StudentRow {
  studentId: string
  status: AttendanceStatus
  notes: string
}

interface AttendanceFormProps {
  students: Student[]
  defaultDate: string
  recorderProfileId: string
  schoolId: string
}

const statusOptions: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'presente',    label: 'Presente',    color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' },
  { value: 'ausente',     label: 'Ausente',     color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' },
  { value: 'tardanza',    label: 'Tardanza',    color: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700' },
  { value: 'justificado', label: 'Justificado', color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700' },
]

/**
 * AttendanceForm — Formulario de registro de asistencia para el staff.
 * Al guardar, inserta en la tabla `attendance` de Supabase.
 * El trigger de BD invoca automáticamente la Edge Function notify-attendance
 * para ausencias y tardanzas.
 */
export default function AttendanceForm({
  students, defaultDate, recorderProfileId, schoolId
}: AttendanceFormProps) {
  const router = useRouter()
  const [date, setDate] = useState(defaultDate)
  const [rows, setRows] = useState<StudentRow[]>(
    students.map((s) => ({ studentId: s.id, status: 'presente', notes: '' }))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mapa rápido studentId → nombre
  const studentMap = Object.fromEntries(students.map((s) => [s.id, s]))

  function updateRow(studentId: string, field: 'status' | 'notes', value: string) {
    setRows((prev) =>
      prev.map((r) => r.studentId === studentId ? { ...r, [field]: value } : r)
    )
  }

  // Estadísticas del día
  const counts = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const supabase = createClient()

    const records = rows.map((r) => ({
      school_id: schoolId,
      student_id: r.studentId,
      recorded_by: recorderProfileId,
      date,
      status: r.status,
      notes: r.notes || null,
    }))

    // Upsert: si ya existe un registro para ese estudiante+fecha, lo actualiza
    const { error: dbError } = await supabase
      .from('attendance')
      .upsert(records, { onConflict: 'student_id,date' })

    if (dbError) {
      setError('Error al guardar. Por favor intenta de nuevo.')
      console.error(dbError)
    } else {
      setSaved(true)
      setTimeout(() => router.push('/dashboard/asistencia'), 1500)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      {/* Selector de fecha */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Fecha:
        </label>
        <DateInputES
          id="attendance-date"
          value={date}
          onChange={(v) => setDate(v && v > defaultDate ? defaultDate : v)}
          fieldClassName="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Resumen del día */}
      <div className="grid grid-cols-4 gap-2">
        {statusOptions.map((opt) => (
          <div key={opt.value} className={`rounded-xl border px-3 py-2 text-center text-xs font-bold ${opt.color}`}>
            <div className="text-lg">{counts[opt.value] ?? 0}</div>
            <div>{opt.label}</div>
          </div>
        ))}
      </div>

      {/* Lista de estudiantes */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {students.length} estudiantes
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => {
            const s = studentMap[row.studentId]
            const currentOpt = statusOptions.find((o) => o.value === row.status)!
            return (
              <div key={row.studentId} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Nombre */}
                <p className="text-sm font-medium text-slate-900 dark:text-white flex-1">
                  {s?.last_name}, {s?.first_name}
                </p>

                {/* Botones de estado */}
                <div className="flex gap-1.5 flex-wrap">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      id={`status-${row.studentId}-${opt.value}`}
                      type="button"
                      onClick={() => updateRow(row.studentId, 'status', opt.value)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                        row.status === opt.value
                          ? opt.color
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Nota (solo si no es presente) */}
                {row.status !== 'presente' && (
                  <input
                    type="text"
                    placeholder="Nota (opcional)"
                    value={row.notes}
                    onChange={(e) => updateRow(row.studentId, 'notes', e.target.value)}
                    className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-40"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Aviso de notificación automática */}
      <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 dark:bg-accent/5 border border-primary/20 dark:border-accent/20 px-4 py-3 text-sm text-primary dark:text-accent-light">
        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          Las ausencias y tardanzas generarán un aviso automático por WhatsApp o correo
          a los padres, redactado por IA.
        </span>
      </div>

      {/* Botón guardar */}
      <button
        id="btn-guardar-asistencia"
        type="button"
        onClick={handleSave}
        disabled={saving || saved}
        className="w-full flex items-center justify-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 text-sm transition shadow-glow disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saved ? (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            ¡Guardado! Redirigiendo...
          </>
        ) : saving ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Guardando...
          </>
        ) : (
          'Guardar asistencia'
        )}
      </button>
    </div>
  )
}
