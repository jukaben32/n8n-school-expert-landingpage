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
    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--dash-text-faint)' }}>
          Grados/secciones asignados
        </p>
        {/* Un docente puede tener asignaciones distintas por categoría:
            los de Inglés y Deporte cubren ciclos completos, no un grado. */}
        <div className="flex gap-1">
          {MESSAGE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold transition"
              style={
                activeCategory === c
                  ? { background: 'var(--dash-accent)', color: 'var(--dash-bg)' }
                  : { background: 'rgba(150,225,196,.10)', color: 'var(--dash-text-muted)' }
              }
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
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:opacity-60${isWholeSchool ? '' : ' dash-chip border-dashed'}`}
          style={
            isWholeSchool
              ? { background: 'var(--dash-accent)', color: 'var(--dash-bg)' }
              : { color: 'var(--dash-text-muted)' }
          }
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
          </>
        )}
        {saved && <span className="text-[11px]" style={{ color: 'var(--dash-accent)' }}>✓ Guardado</span>}
      </div>

      {!isWholeSchool && grades.length === 0 && (
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--dash-warning)' }}>
          {activeCategory === 'regular'
            ? 'Sin grados asignados: por ahora no ve estudiantes en Asistencia ni Actualizaciones.'
            : `Sin grados asignados en ${MESSAGE_CATEGORY_LABELS[activeCategory]}: por ahora no recibe mensajes ni puede publicar comunicados en esta categoría.`}
        </p>
      )}
    </div>
  )
}
