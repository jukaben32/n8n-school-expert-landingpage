'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Catalog { id: string; name: string }

interface NewLessonFormProps {
  schoolId: string
  authorProfileId: string
  subjects: Catalog[]
  gradeLevels: Catalog[]
}

interface DraftOption { key: string; label: string; isCorrect: boolean }
interface DraftQuestion { key: string; prompt: string; points: number; options: DraftOption[] }

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

function newQuestion(): DraftQuestion {
  return {
    key: crypto.randomUUID(),
    prompt: '',
    points: 10,
    options: [
      { key: crypto.randomUUID(), label: '', isCorrect: true },
      { key: crypto.randomUUID(), label: '', isCorrect: false },
    ],
  }
}

export default function NewLessonForm({ schoolId, authorProfileId, subjects, gradeLevels }: NewLessonFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '')
  const [gradeLevelId, setGradeLevelId] = useState(gradeLevels[0]?.id ?? '')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoProvider, setVideoProvider] = useState<'youtube' | 'vimeo'>('youtube')
  const [isPublished, setIsPublished] = useState(true)
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Catálogo rápido: crear materia/grado sin salir del formulario
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newGradeName, setNewGradeName] = useState('')
  const [localSubjects, setLocalSubjects] = useState(subjects)
  const [localGrades, setLocalGrades] = useState(gradeLevels)
  const [creatingCatalog, setCreatingCatalog] = useState<'subject' | 'grade' | null>(null)

  async function addSubject() {
    if (!newSubjectName.trim()) return
    setCreatingCatalog('subject')
    const supabase = createClient()
    const { data, error: err } = await supabase.from('subjects').insert({ school_id: schoolId, name: newSubjectName.trim() }).select('id, name').single()
    if (!err && data) {
      setLocalSubjects((prev) => [...prev, data])
      setSubjectId(data.id)
      setNewSubjectName('')
    }
    setCreatingCatalog(null)
  }

  async function addGrade() {
    if (!newGradeName.trim()) return
    setCreatingCatalog('grade')
    const supabase = createClient()
    const { data, error: err } = await supabase.from('grade_levels').insert({ school_id: schoolId, name: newGradeName.trim() }).select('id, name').single()
    if (!err && data) {
      setLocalGrades((prev) => [...prev, data])
      setGradeLevelId(data.id)
      setNewGradeName('')
    }
    setCreatingCatalog(null)
  }

  function updateQuestion(key: string, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)))
  }
  function updateOption(qKey: string, oKey: string, patch: Partial<DraftOption>) {
    setQuestions((prev) => prev.map((q) => q.key !== qKey ? q : {
      ...q,
      options: q.options.map((o) => o.key === oKey ? { ...o, ...patch } : o),
    }))
  }
  function setCorrectOption(qKey: string, oKey: string) {
    setQuestions((prev) => prev.map((q) => q.key !== qKey ? q : {
      ...q,
      options: q.options.map((o) => ({ ...o, isCorrect: o.key === oKey })),
    }))
  }
  function addOption(qKey: string) {
    setQuestions((prev) => prev.map((q) => q.key !== qKey ? q : {
      ...q,
      options: q.options.length >= 5 ? q.options : [...q.options, { key: crypto.randomUUID(), label: '', isCorrect: false }],
    }))
  }
  function removeOption(qKey: string, oKey: string) {
    setQuestions((prev) => prev.map((q) => q.key !== qKey ? q : {
      ...q,
      options: q.options.length <= 2 ? q.options : q.options.filter((o) => o.key !== oKey),
    }))
  }
  function addQuestion() {
    setQuestions((prev) => [...prev, newQuestion()])
  }
  function removeQuestion(key: string) {
    setQuestions((prev) => (prev.length <= 1 ? prev : prev.filter((q) => q.key !== key)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!title.trim() || !videoUrl.trim() || !subjectId || !gradeLevelId) {
      setError('Completa el título, el video, la materia y el grado.')
      return
    }
    for (const q of questions) {
      if (!q.prompt.trim()) { setError('Cada pregunta necesita un enunciado.'); return }
      if (q.options.some((o) => !o.label.trim())) { setError('Completa el texto de todas las opciones.'); return }
      if (!q.options.some((o) => o.isCorrect)) { setError('Marca la opción correcta en cada pregunta.'); return }
    }

    setSaving(true)
    const supabase = createClient()

    try {
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .insert({
          school_id: schoolId,
          subject_id: subjectId,
          grade_level_id: gradeLevelId,
          title: title.trim(),
          description: description.trim() || null,
          video_url: videoUrl.trim(),
          video_provider: videoProvider,
          is_published: isPublished,
          created_by: authorProfileId,
        })
        .select('id')
        .single()
      if (lessonError || !lesson) throw lessonError ?? new Error('No se pudo crear la lección.')

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        const { data: question, error: qError } = await supabase
          .from('quiz_questions')
          .insert({ lesson_id: lesson.id, prompt: q.prompt.trim(), points: q.points, sort_order: i })
          .select('id')
          .single()
        if (qError || !question) throw qError ?? new Error('No se pudo crear una pregunta.')

        const { error: oError } = await supabase.from('quiz_options').insert(
          q.options.map((o, idx) => ({
            question_id: question.id,
            label: o.label.trim(),
            is_correct: o.isCorrect,
            sort_order: idx,
          }))
        )
        if (oError) throw oError
      }

      router.push('/dashboard/academia/progreso')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ocurrió un error al guardar. Intenta de nuevo.'
      setError(message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Datos de la lección */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div>
          <label htmlFor="title" className={labelClass}>Título</label>
          <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Las fracciones" className={inputClass} />
        </div>
        <div>
          <label htmlFor="description" className={labelClass}>Descripción (opcional)</label>
          <input id="description" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="subject" className={labelClass}>Materia</label>
            {localSubjects.length > 0 ? (
              <select id="subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputClass}>
                {localSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">Aún no hay materias — agrega una abajo.</p>
            )}
            <div className="flex gap-2 mt-2">
              <input value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} placeholder="Nueva materia" className={`${inputClass} text-xs py-1.5`} />
              <button type="button" onClick={addSubject} disabled={creatingCatalog === 'subject'} className="shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300">+</button>
            </div>
          </div>
          <div>
            <label htmlFor="grade" className={labelClass}>Grado</label>
            {localGrades.length > 0 ? (
              <select id="grade" value={gradeLevelId} onChange={(e) => setGradeLevelId(e.target.value)} className={inputClass}>
                {localGrades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">Aún no hay grados — agrega uno abajo.</p>
            )}
            <div className="flex gap-2 mt-2">
              <input value={newGradeName} onChange={(e) => setNewGradeName(e.target.value)} placeholder="Nuevo grado" className={`${inputClass} text-xs py-1.5`} />
              <button type="button" onClick={addGrade} disabled={creatingCatalog === 'grade'} className="shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300">+</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label htmlFor="videoUrl" className={labelClass}>Link del video</label>
            <input id="videoUrl" required value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className={inputClass} />
          </div>
          <div>
            <label htmlFor="provider" className={labelClass}>Proveedor</label>
            <select id="provider" value={videoProvider} onChange={(e) => setVideoProvider(e.target.value as 'youtube' | 'vimeo')} className={inputClass}>
              <option value="youtube">YouTube</option>
              <option value="vimeo">Vimeo</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="rounded" />
          Publicar de inmediato (visible para los estudiantes del grado)
        </label>
      </div>

      {/* Cuestionario */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Cuestionario
        </p>
        {questions.map((q, qi) => (
          <div key={q.key} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500">Pregunta {qi + 1}</span>
              {questions.length > 1 && (
                <button type="button" onClick={() => removeQuestion(q.key)} className="text-xs text-red-500 hover:text-red-600">Quitar</button>
              )}
            </div>
            <input
              value={q.prompt}
              onChange={(e) => updateQuestion(q.key, { prompt: e.target.value })}
              placeholder="Escribe la pregunta..."
              className={inputClass}
            />
            <div className="space-y-2">
              {q.options.map((o) => (
                <div key={o.key} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${q.key}`}
                    checked={o.isCorrect}
                    onChange={() => setCorrectOption(q.key, o.key)}
                    aria-label="Marcar como respuesta correcta"
                  />
                  <input
                    value={o.label}
                    onChange={(e) => updateOption(q.key, o.key, { label: e.target.value })}
                    placeholder="Opción..."
                    className={`${inputClass} py-1.5`}
                  />
                  {q.options.length > 2 && (
                    <button type="button" onClick={() => removeOption(q.key, o.key)} className="shrink-0 text-slate-400 hover:text-red-500 text-sm">✕</button>
                  )}
                </div>
              ))}
              {q.options.length < 5 && (
                <button type="button" onClick={() => addOption(q.key)} className="text-xs font-semibold text-primary dark:text-accent-light">
                  + Agregar opción
                </button>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addQuestion}
          className="w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-3 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:border-primary/40 transition"
        >
          + Agregar otra pregunta
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition shadow-glow disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando...' : 'Guardar lección'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-slate-200 dark:border-slate-700 px-6 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
