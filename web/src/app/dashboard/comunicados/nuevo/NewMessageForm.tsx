'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createMessageAction } from './actions'
import { MESSAGE_CATEGORY_LABELS, type MessageCategory } from '@/lib/messaging/categoryAccess'

interface NewMessageFormProps {
  gradeLevelOptions: string[]
  /** true para 'teacher': no puede mandar a todo el colegio, solo a sus grados asignados. */
  forceGradeMode?: boolean
  /** Categorías en las que quien publica tiene permiso (ver categoryAccess.ts). Si es solo ['regular'], no se muestra selector. */
  availableCategories: MessageCategory[]
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'

const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

/**
 * NewMessageForm — Crea un comunicado en la tabla `messages`.
 * "Guardar borrador" deja published_at en null (solo visible para staff).
 * "Publicar ahora" establece published_at = now() (visible para familias).
 */
export default function NewMessageForm({ gradeLevelOptions, forceGradeMode = false, availableCategories }: NewMessageFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
  const [category, setCategory] = useState<MessageCategory>(availableCategories[0] ?? 'regular')
  const [audienceMode, setAudienceMode] = useState<'all' | 'grades'>(forceGradeMode ? 'grades' : 'all')
  const [selectedGrades, setSelectedGrades] = useState<string[]>([])
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleGrade(grade: string) {
    setSelectedGrades((prev) => (prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]))
  }

  async function handleSave(publish: boolean) {
    setError(null)
    if (!title.trim() || !body.trim()) {
      setError('El título y el contenido son obligatorios.')
      return
    }
    if (audienceMode === 'grades' && selectedGrades.length === 0) {
      setError('Elige al menos un grado/sección, o cambia a "Todo el colegio".')
      return
    }
    setSaving(publish ? 'publish' : 'draft')

    const result = await createMessageAction({
      title,
      body,
      priority,
      publish,
      gradeLevels: audienceMode === 'grades' ? selectedGrades : [],
      category,
    })

    if (!result.ok) {
      setError(result.error ?? 'No se pudo guardar el comunicado. Intenta de nuevo.')
      setSaving(null)
      return
    }

    router.push('/dashboard/comunicados')
    router.refresh()
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div>
          <label htmlFor="title" className={labelClass}>Título</label>
          <input
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Suspensión de clases por lluvias"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="body" className={labelClass}>Contenido</label>
          <textarea
            id="body"
            required
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escribe el mensaje que recibirán las familias..."
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label className={labelClass}>Prioridad</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPriority('normal')}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                priority === 'normal'
                  ? 'bg-primary text-white shadow-glow'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => setPriority('urgent')}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                priority === 'urgent'
                  ? 'bg-orange-500 text-white shadow-glow'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Urgente
            </button>
          </div>
        </div>

        {availableCategories.length > 1 && (
          <div>
            <label className={labelClass}>Categoría</label>
            <div className="flex gap-2">
              {availableCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    category === c
                      ? 'bg-primary text-white shadow-glow'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {MESSAGE_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <label className={labelClass}>¿A quién le llega?</label>
        {forceGradeMode ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 -mt-1">
            Solo puedes avisar a tus grados/secciones asignados, no a todo el colegio.
          </p>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAudienceMode('all')}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                audienceMode === 'all'
                  ? 'bg-primary text-white shadow-glow'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Todo el colegio
            </button>
            <button
              type="button"
              onClick={() => setAudienceMode('grades')}
              disabled={gradeLevelOptions.length === 0}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                audienceMode === 'grades'
                  ? 'bg-primary text-white shadow-glow'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Grado/sección específico
            </button>
          </div>
        )}

        {audienceMode === 'grades' && (
          gradeLevelOptions.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {gradeLevelOptions.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => toggleGrade(grade)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    selectedGrades.includes(grade)
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {forceGradeMode
                ? 'Todavía no tienes ningún grado/sección asignado — pídele a dirección que te lo asigne en Personal.'
                : 'Todavía no hay grados/secciones asignados a ningún estudiante (se asignan desde la ficha de cada estudiante en Estudiantes).'}
            </p>
          )
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          id="btn-publicar-comunicado"
          disabled={saving !== null}
          onClick={() => handleSave(true)}
          className="flex-1 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition shadow-glow disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving === 'publish' ? 'Publicando...' : 'Publicar ahora'}
        </button>
        <button
          type="button"
          id="btn-guardar-borrador"
          disabled={saving !== null}
          onClick={() => handleSave(false)}
          className="rounded-full border border-slate-200 dark:border-slate-700 px-6 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-60"
        >
          {saving === 'draft' ? 'Guardando...' : 'Guardar borrador'}
        </button>
      </div>
    </form>
  )
}
