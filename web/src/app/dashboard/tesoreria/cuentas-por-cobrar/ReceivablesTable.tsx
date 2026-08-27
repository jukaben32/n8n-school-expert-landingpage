'use client'

import { useMemo, useState } from 'react'
import { sendOverdueReminder, generateLateFeeCharge } from './actions'

export interface ReceivableRow {
  student_id: string
  first_name: string
  last_name: string
  grade_level: string | null
  family_id: string
  family_name?: string
  school_level: string | null
  monthly_amount: number | null
  expected_to_date: number | null
  collected_amount: number | null
  overdue_amount: number | null
  oldest_overdue_due_date: string | null
  oldest_overdue_reference: string | null
  days_overdue: number | null
  aging_bucket: string | null
}

const LEVEL_LABELS: Record<string, string> = {
  parvulo: 'Párvulos',
  inicial: 'Inicial',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
}

const BUCKET_ORDER = ['6-9', '10-14', '15-19', '20-30', '31-60', '61+']
const BUCKET_COLORS: Record<string, string> = {
  '6-9': 'var(--dash-warning)',
  '10-14': 'var(--dash-warning)',
  '15-19': 'var(--dash-danger)',
  '20-30': 'var(--dash-danger)',
  '31-60': 'var(--dash-danger-strong)',
  '61+': 'var(--dash-danger-strong)',
}

const formatDOP = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' })
const thClass = 'px-4 py-3 font-barlow uppercase tracking-wide text-xs'

export default function ReceivablesTable({
  rows,
  graceDays,
  lateFeePercent,
}: {
  rows: ReceivableRow[]
  graceDays: number
  lateFeePercent: number
}) {
  const [levelFilter, setLevelFilter] = useState('todos')
  const [gradeFilter, setGradeFilter] = useState('todos')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  const notConfigured = rows.filter((r) => r.aging_bucket === 'sin_configurar')
  const overdue = rows.filter((r) => r.aging_bucket && BUCKET_ORDER.includes(r.aging_bucket))

  const levels = useMemo(
    () => Array.from(new Set(overdue.map((r) => r.school_level).filter((v): v is string => !!v))),
    [overdue]
  )

  const gradesForLevel = useMemo(() => {
    const pool = levelFilter === 'todos' ? overdue : overdue.filter((r) => r.school_level === levelFilter)
    return Array.from(new Set(pool.map((r) => r.grade_level).filter((v): v is string => !!v))).sort()
  }, [overdue, levelFilter])

  const filtered = overdue
    .filter((r) => levelFilter === 'todos' || r.school_level === levelFilter)
    .filter((r) => gradeFilter === 'todos' || r.grade_level === gradeFilter)
    .sort((a, b) => (b.days_overdue ?? 0) - (a.days_overdue ?? 0))

  const totalOverdue = filtered.reduce((sum, r) => sum + (r.overdue_amount ?? 0), 0)
  const familiesCount = new Set(filtered.map((r) => r.family_id)).size

  async function handleReminder(studentId: string) {
    setBusyId(studentId)
    setFeedback((prev) => ({ ...prev, [studentId]: '' }))
    const result = await sendOverdueReminder(studentId)
    setBusyId(null)
    setFeedback((prev) => ({ ...prev, [studentId]: result.ok ? 'Aviso enviado.' : (result.error ?? 'No se pudo enviar.') }))
  }

  async function handleLateFee(studentId: string) {
    if (!confirm(`¿Generar el recargo por mora (${lateFeePercent}%) para este estudiante? Esto crea una factura real.`)) return
    setBusyId(studentId)
    setFeedback((prev) => ({ ...prev, [studentId]: '' }))
    const result = await generateLateFeeCharge(studentId)
    setBusyId(null)
    setFeedback((prev) => ({ ...prev, [studentId]: result.ok ? 'Recargo generado.' : (result.error ?? 'No se pudo generar.') }))
  }

  return (
    <div className="space-y-4">
      {notConfigured.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {notConfigured.length} estudiante{notConfigured.length !== 1 ? 's' : ''} no aparece{notConfigured.length !== 1 ? 'n' : ''} aquí
          porque su nivel todavía no tiene mensualidad configurada.{' '}
          <a href="/dashboard/colegio" className="underline font-semibold">Configúrala en Colegio →</a>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="dash-card p-5">
          <p className="text-sm font-semibold" style={{ color: 'var(--dash-text-muted)' }}>Total vencido</p>
          <p className="text-2xl font-bold font-barlow mt-1" style={{ color: 'var(--dash-text)' }}>{formatDOP.format(totalOverdue)}</p>
        </div>
        <div className="dash-card p-5">
          <p className="text-sm font-semibold" style={{ color: 'var(--dash-text-muted)' }}>Estudiantes vencidos</p>
          <p className="text-2xl font-bold font-barlow mt-1" style={{ color: 'var(--dash-text)' }}>{filtered.length}</p>
        </div>
        <div className="dash-card p-5">
          <p className="text-sm font-semibold" style={{ color: 'var(--dash-text-muted)' }}>Familias afectadas</p>
          <p className="text-2xl font-bold font-barlow mt-1" style={{ color: 'var(--dash-text)' }}>{familiesCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={levelFilter}
          onChange={(e) => { setLevelFilter(e.target.value); setGradeFilter('todos') }}
          className="rounded-full border border-slate-200 bg-white text-sm px-4 py-2 text-slate-700"
        >
          <option value="todos">Todos los niveles</option>
          {levels.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l] ?? l}</option>)}
        </select>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="rounded-full border border-slate-200 bg-white text-sm px-4 py-2 text-slate-700"
        >
          <option value="todos">Todos los cursos</option>
          {gradesForLevel.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">✅</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
            Ningún estudiante tiene cuentas vencidas por más de {graceDays} días.
          </p>
        </div>
      ) : (
        <div className="dash-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
              <tr>
                <th className={thClass} style={{ color: 'var(--dash-text-muted)' }}>Estudiante</th>
                <th className={thClass} style={{ color: 'var(--dash-text-muted)' }}>Curso</th>
                <th className={thClass} style={{ color: 'var(--dash-text-muted)' }}>Familia</th>
                <th className={`${thClass} text-right`} style={{ color: 'var(--dash-text-muted)' }}>Monto vencido</th>
                <th className={thClass} style={{ color: 'var(--dash-text-muted)' }}>Referencia</th>
                <th className={`${thClass} text-center`} style={{ color: 'var(--dash-text-muted)' }}>Tramo</th>
                <th className={thClass} style={{ color: 'var(--dash-text-muted)' }}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgba(150,225,196,.08)' }}>
              {filtered.map((r) => (
                <tr key={r.student_id} className="align-top">
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--dash-text)' }}>
                    {r.first_name} {r.last_name}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--dash-text-muted)' }}>{r.grade_level ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--dash-text-muted)' }}>{r.family_name ?? 'Familia N/A'}</td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--dash-text)' }}>
                    {formatDOP.format(r.overdue_amount ?? 0)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--dash-text-faint)' }}>
                    {r.oldest_overdue_reference}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="px-2 py-1 rounded-full text-[10px] font-bold font-barlow uppercase tracking-wider border"
                      style={{ color: BUCKET_COLORS[r.aging_bucket ?? ''], borderColor: 'currentColor' }}
                    >
                      {r.aging_bucket} días
                    </span>
                  </td>
                  <td className="px-4 py-3 space-y-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === r.student_id}
                        onClick={() => handleReminder(r.student_id)}
                        className="rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 transition disabled:opacity-50"
                      >
                        Enviar aviso
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.student_id}
                        onClick={() => handleLateFee(r.student_id)}
                        className="rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 transition disabled:opacity-50"
                      >
                        Generar recargo
                      </button>
                    </div>
                    {feedback[r.student_id] && (
                      <p className="text-xs" style={{ color: 'var(--dash-text-muted)' }}>{feedback[r.student_id]}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
