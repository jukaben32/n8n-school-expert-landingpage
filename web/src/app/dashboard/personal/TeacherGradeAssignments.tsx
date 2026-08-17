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
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
        Grados/secciones asignados
      </p>
      <div className="flex flex-wrap gap-1.5 items-center">
        {grades.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => toggle(g)}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary dark:text-accent-light px-2.5 py-1 text-xs font-semibold disabled:opacity-60"
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
            className="inline-flex items-center rounded-full border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 px-2.5 py-1 text-xs font-medium hover:border-primary/40 disabled:opacity-60"
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
          className="w-28 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary"
        />
        {saved && <span className="text-[11px] text-green-600 dark:text-green-400">✓ Guardado</span>}
      </div>
      {grades.length === 0 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
          Sin grados asignados: por ahora no ve estudiantes en Asistencia ni Actualizaciones.
        </p>
      )}
    </div>
  )
}
