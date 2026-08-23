'use client'

import { useState } from 'react'
import { setTeacherGradeAssignmentsAction } from './assignmentsActions'

export default function TeacherGradeAssignments({
  staffId,
  initialGrades,
  gradeLevelOptions,
}: {
  staffId: string
  initialGrades: string[]
  gradeLevelOptions: string[]
}) {
  const [grades, setGrades] = useState<string[]>(initialGrades)
  const [customInput, setCustomInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function persist(next: string[]) {
    setGrades(next)
    setSaved(false)
    setSaving(true)
    const result = await setTeacherGradeAssignmentsAction(staffId, next)
    setSaving(false)
    if (result.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  function toggle(grade: string) {
    persist(grades.includes(grade) ? grades.filter((g) => g !== grade) : [...grades, grade])
  }

  function addCustom() {
    const value = customInput.trim()
    if (!value || grades.includes(value)) {
      setCustomInput('')
      return
    }
    setCustomInput('')
    persist([...grades, value])
  }

  const extraOptions = gradeLevelOptions.filter((g) => !grades.includes(g))

  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
      <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--dash-text-faint)' }}>
        Grados/secciones asignados
      </p>
      <div className="flex flex-wrap gap-1.5 items-center">
        {grades.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => toggle(g)}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold disabled:opacity-60"
            style={{ background: 'rgba(74,222,159,.15)', color: 'var(--dash-accent)' }}
          >
            {g} <span aria-hidden="true">&times;</span>
          </button>
        ))}
        {extraOptions.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => toggle(g)}
            disabled={saving}
            className="dash-chip inline-flex items-center border-dashed px-2.5 py-1 text-xs font-medium disabled:opacity-60"
            style={{ color: 'var(--dash-text-muted)' }}
          >
            + {g}
          </button>
        ))}
        <input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
          onBlur={addCustom}
          placeholder="Otro grado…"
          className="w-28 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary"
        />
        {saved && <span className="text-[11px]" style={{ color: 'var(--dash-accent)' }}>✓ Guardado</span>}
      </div>
      {grades.length === 0 && (
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--dash-warning)' }}>
          Sin grados asignados: por ahora no ve estudiantes en Asistencia ni Actualizaciones.
        </p>
      )}
    </div>
  )
}
