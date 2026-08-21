'use client'

import { useState } from 'react'
import Link from 'next/link'
import { setGradeAction } from './actions'

interface Student {
  id: string
  first_name: string
  last_name: string
}
interface ExistingGrade {
  student_id: string
  score: number
  comment: string | null
}

export default function GradesGrid({
  subjectId,
  gradingPeriodId,
  editable,
  students,
  existingGrades,
}: {
  subjectId: string
  gradingPeriodId: string
  editable: boolean
  students: Student[]
  existingGrades: ExistingGrade[]
}) {
  const gradeByStudent = new Map(existingGrades.map((g) => [g.student_id, g]))
  const [scores, setScores] = useState<Map<string, string>>(new Map(students.map((s) => [s.id, gradeByStudent.get(s.id)?.score?.toString() ?? ''])))
  const [comments, setComments] = useState<Map<string, string>>(new Map(students.map((s) => [s.id, gradeByStudent.get(s.id)?.comment ?? ''])))
  const [savingId, setSavingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<{ id: string; message: string } | null>(null)

  async function handleBlur(studentId: string) {
    if (!editable) return
    setSavingId(studentId)
    setErrorId(null)
    const result = await setGradeAction(studentId, subjectId, gradingPeriodId, scores.get(studentId) ?? '', comments.get(studentId) ?? '')
    setSavingId(null)
    if (!result.ok) setErrorId({ id: studentId, message: result.error ?? 'No se pudo guardar.' })
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/50">
      {students.map((s) => (
        <div key={s.id} className="flex items-center gap-3 px-4 py-3">
          <Link href={`/dashboard/notas/boletin/${s.id}`} className="flex-1 min-w-0 text-sm font-medium text-slate-900 dark:text-white hover:text-primary dark:hover:text-accent-light truncate">
            {s.last_name}, {s.first_name}
          </Link>
          <input
            type="text"
            inputMode="decimal"
            placeholder="—"
            disabled={!editable || savingId === s.id}
            value={scores.get(s.id) ?? ''}
            onChange={(e) => setScores((prev) => new Map(prev).set(s.id, e.target.value))}
            onBlur={() => handleBlur(s.id)}
            className="w-16 text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm font-semibold text-slate-900 dark:text-white disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-800/50"
          />
          <input
            type="text"
            placeholder="Comentario (opcional)"
            disabled={!editable || savingId === s.id}
            value={comments.get(s.id) ?? ''}
            onChange={(e) => setComments((prev) => new Map(prev).set(s.id, e.target.value))}
            onBlur={() => handleBlur(s.id)}
            className="w-48 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-800/50"
          />
          {errorId?.id === s.id && <p className="text-xs text-red-500 shrink-0">{errorId.message}</p>}
        </div>
      ))}
    </div>
  )
}
