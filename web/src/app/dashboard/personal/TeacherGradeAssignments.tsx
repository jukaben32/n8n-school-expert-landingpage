'use client'

import { useState } from 'react'
import { setTeacherGradeAssignmentsAction } from './assignmentsActions'
import { MESSAGE_CATEGORIES, MESSAGE_CATEGORY_LABELS, type MessageCategory } from '@/lib/messaging/categoryAccess'

interface Assignment {
  category: MessageCategory
  gradeLevel: string | null
}

/**
 * Asignación de grados/secciones por categoría (Regular/Inglés/Deporte,
 * ver migración 034) -- un profesor puede tener asignaciones en más de una
 * categoría (ej. regular + inglés no aplica en este colegio, pero el
 * mecanismo lo permite). "Todo el colegio" guarda una fila con
 * grade_level=null: para un docente único de todo el colegio en su
 * categoría (ej. Educación Física), sin tener que listar cada grado.
 */
export default function TeacherGradeAssignments({
  staffId,
  initialAssignments,
  gradeLevelOptions,
}: {
  staffId: string
  initialAssignments: Assignment[]
  gradeLevelOptions: string[]
}) {
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments)
  const [activeCategory, setActiveCategory] = useState<MessageCategory>('regular')
  const [customInput, setCustomInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const entriesForCategory = assignments.filter((a) => a.category === activeCategory)
  const isWholeSchool = entriesForCategory.some((a) => a.gradeLevel === null)
  const grades = entriesForCategory.map((a) => a.gradeLevel).filter((g): g is string => g !== null)

  async function persist(nextGrades: string[], nextWholeSchool: boolean) {
    setAssignments((prev) => [
      ...prev.filter((a) => a.category !== activeCategory),
      ...(nextWholeSchool
        ? [{ category: activeCategory, gradeLevel: null }]
        : nextGrades.map((g) => ({ category: activeCategory, gradeLevel: g }))),
    ])
    setSaved(false)
    setSaving(true)
    const result = await setTeacherGradeAssignmentsAction(staffId, activeCategory, nextGrades, nextWholeSchool)
    setSaving(false)
    if (result.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  function toggle(grade: string) {
    persist(grades.includes(grade) ? grades.filter((g) => g !== grade) : [...grades, grade], false)
  }

  function addCustom() {
    const value = customInput.trim()
    if (!value || grades.includes(value)) {
      setCustomInput('')
      return
    }
    setCustomInput('')
    persist([...grades, value], false)
  }

  function toggleWholeSchool() {
    persist([], !isWholeSchool)
  }

  const extraOptions = gradeLevelOptions.filter((g) => !grades.includes(g))

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Grados/secciones asignados
        </p>
        <div className="flex gap-1">
          {MESSAGE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                activeCategory === c
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              {MESSAGE_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        <button
          type="button"
          onClick={toggleWholeSchool}
          disabled={saving}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:opacity-60 ${
            isWholeSchool
              ? 'bg-primary text-white'
              : 'border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary/40'
          }`}
        >
          Todo el colegio
        </button>

        {!isWholeSchool && (
          <>
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
          </>
        )}
        {saved && <span className="text-[11px] text-green-600 dark:text-green-400">✓ Guardado</span>}
      </div>

      {!isWholeSchool && grades.length === 0 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
          {activeCategory === 'regular'
            ? 'Sin grados asignados: por ahora no ve estudiantes en Asistencia ni Actualizaciones.'
            : `Sin grados asignados en ${MESSAGE_CATEGORY_LABELS[activeCategory]}: por ahora no recibe mensajes ni puede publicar comunicados en esta categoría.`}
        </p>
      )}
    </div>
  )
}
