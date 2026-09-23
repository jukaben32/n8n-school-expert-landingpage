'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createIncidentAction } from '../actions'
import { SEVERITIES, LOCATIONS, MEASURES, RECIDIVISM_DAYS } from '@/lib/incidents/labels'

const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 transition focus:outline-none focus:ring-2 focus:ring-primary'
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1'
const sectionTitle = 'text-sm font-bold text-slate-800 dark:text-slate-100'

type Student = { id: string; name: string; grade: string }

export default function NewIncidentForm({ students, today }: { students: Student[]; today: string }) {
  const router = useRouter()
  const grades = useMemo(() => Array.from(new Set(students.map((s) => s.grade))), [students])
  const [grade, setGrade] = useState(grades.length === 1 ? grades[0] : '')
  const [studentId, setStudentId] = useState('')
  const [incidentDate, setIncidentDate] = useState(today)
  const [incidentTime, setIncidentTime] = useState('')
  const [location, setLocation] = useState('aula')
  const [locationOther, setLocationOther] = useState('')
  const [severity, setSeverity] = useState('')
  const [description, setDescription] = useState('')
  const [measures, setMeasures] = useState<string[]>([])
  const [studentHeard, setStudentHeard] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<{ id: string; n: number } | null>(null)

  const studentsInGrade = students.filter((s) => s.grade === grade)

  function toggleMeasure(value: string) {
    setMeasures((prev) => (prev.includes(value) ? prev.filter((m) => m !== value) : [...prev, value]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const result = await createIncidentAction({
        studentId, incidentDate, incidentTime, location, locationOther, severity, description, measures, studentHeard,
      })
      if (!result.ok || !result.id) {
        setError(result.error ?? 'No se pudo guardar la incidencia.')
        return
      }
      if (result.recentLeves) {
        // Se queda en pantalla para que el aviso de reincidencia se lea.
        setWarning({ id: result.id, n: result.recentLeves })
        return
      }
      router.push(`/dashboard/incidencias/${result.id}`)
    } catch {
      setError('No se pudo conectar con el servidor. Recarga la página y vuelve a registrarla (no se guardó nada).')
    } finally {
      setSaving(false)
    }
  }

  if (warning) {
    return (
      <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-5 space-y-3">
        <p className="font-semibold text-red-700 dark:text-red-400">Incidencia guardada. Atención: reincidencia.</p>
        <p className="text-sm text-red-700 dark:text-red-400">
          Este estudiante suma {warning.n} faltas leves en los últimos {RECIDIVISM_DAYS} días. Según la Regla del 3,
          se trata como <strong>falta grave por reincidencia</strong>: corresponde remitir a Orientación y notificar a la familia.
        </p>
        <button type="button" onClick={() => router.push(`/dashboard/incidencias/${warning.id}`)} className="dash-btn-primary text-sm px-5 py-2.5">
          Ver la incidencia
        </button>
      </div>
    )
  }

  if (students.length === 0) {
    return (
      <div className="dash-card border-dashed p-8 text-center text-sm" style={{ color: 'var(--dash-text-muted)' }}>
        No tienes estudiantes asignados. Pide a Dirección que te asigne tus cursos en Personal.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="dash-card p-5 space-y-4">
        <p className={sectionTitle}>1. Datos generales</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Curso</label>
            <select value={grade} onChange={(e) => { setGrade(e.target.value); setStudentId('') }} className={inputClass} required>
              <option value="">Elige el curso</option>
              {grades.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Estudiante</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputClass} required disabled={!grade}>
              <option value="">Elige el estudiante</option>
              {studentsInGrade.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Fecha</label>
            <input type="date" value={incidentDate} max={today} onChange={(e) => setIncidentDate(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Hora (opcional)</label>
            <input type="time" value={incidentTime} onChange={(e) => setIncidentTime(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Lugar</label>
          <div className="flex flex-wrap gap-3">
            {LOCATIONS.map((l) => (
              <label key={l.value} className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                <input type="radio" name="location" value={l.value} checked={location === l.value} onChange={() => setLocation(l.value)} />
                {l.label}
              </label>
            ))}
          </div>
          {location === 'otro' && (
            <input value={locationOther} onChange={(e) => setLocationOther(e.target.value)} placeholder="¿Dónde?" className={`${inputClass} mt-2`} />
          )}
        </div>
      </div>

      <div className="dash-card p-5 space-y-3">
        <p className={sectionTitle}>2. Clasificación de la falta (según normativa)</p>
        {SEVERITIES.map((s) => (
          <label key={s.value} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input type="radio" name="severity" value={s.value} checked={severity === s.value} onChange={() => setSeverity(s.value)} className="mt-1" required />
            <span><strong>{s.label}:</strong> {s.hint}</span>
          </label>
        ))}
        <div>
          <label className={labelClass}>Descripción breve de los hechos</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
            placeholder="Ej.: El estudiante fue sorprendido rayando la butaca con un marcador permanente tras ser advertido previamente."
            className={inputClass}
          />
          <p className="text-xs mt-1 text-slate-500">Escribe solo lo que viste o escuchaste, no lo que &quot;crees&quot; que el estudiante pensaba.</p>
        </div>
      </div>

      <div className="dash-card p-5 space-y-3">
        <p className={sectionTitle}>3. Medida educativa aplicada (Art. 15-20)</p>
        {MEASURES.map((m) => (
          <label key={m.value} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={measures.includes(m.value)} onChange={() => toggleMeasure(m.value)} />
            {m.label}
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 pt-2">
          <input type="checkbox" checked={studentHeard} onChange={(e) => setStudentHeard(e.target.checked)} />
          El estudiante fue escuchado y pudo dar su versión
        </label>
      </div>

      <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 px-4 py-3 text-xs text-sky-800 dark:text-sky-300 space-y-1">
        <p className="font-semibold">Tips para el docente</p>
        <p><strong>Objetividad:</strong> en lugar de &quot;el niño estaba siendo malo&quot;, escribe &quot;el niño empujó a su compañero&quot;.</p>
        <p><strong>La Regla del 3:</strong> 3 faltas leves en un mes se convierten en falta grave por reincidencia. La plataforma te avisa sola.</p>
        <p><strong>Privacidad:</strong> nunca llenes el registro frente a todo el curso.</p>
      </div>

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button type="submit" disabled={saving} className="dash-btn-primary w-full text-sm py-2.5 disabled:opacity-60">
        {saving ? 'Guardando...' : 'Guardar incidencia'}
      </button>
    </form>
  )
}
