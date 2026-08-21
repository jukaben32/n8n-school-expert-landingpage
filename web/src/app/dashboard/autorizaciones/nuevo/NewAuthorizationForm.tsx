'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthorizationAction } from '../actions'
import DraftAssistant from '@/components/dashboard/DraftAssistant'

interface NewAuthorizationFormProps {
  gradeLevelOptions: string[]
  forceGradeMode?: boolean
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

export default function NewAuthorizationForm({ gradeLevelOptions, forceGradeMode = false }: NewAuthorizationFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [audienceMode, setAudienceMode] = useState<'all' | 'grade'>(forceGradeMode ? 'grade' : 'all')
  const [selectedGrade, setSelectedGrade] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    if (!title.trim() || !description.trim()) {
      setError('El título y la descripción son obligatorios.')
      return
    }
    if (audienceMode === 'grade' && !selectedGrade) {
      setError('Elige un grado/sección, o cambia a "Todo el colegio".')
      return
    }
    setSaving(true)
    const result = await createAuthorizationAction({
      title, description, eventDate, gradeLevel: audienceMode === 'grade' ? selectedGrade : '',
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo crear la autorización.')
      return
    }
    router.push('/dashboard/autorizaciones')
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
            placeholder="Ej. Excursión al Museo de Historia Natural"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="eventDate" className={labelClass}>Fecha del evento (opcional)</label>
          <input id="eventDate" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label htmlFor="description" className={labelClass}>Qué se autoriza (texto completo)</label>
          <textarea
            id="description"
            required
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej. Autorizo a mi hijo/a a participar en la excursión al Museo de Historia Natural el día X, saliendo del colegio a las 8:00am en autobús contratado por la institución y regresando a las 2:00pm..."
            className={`${inputClass} resize-none`}
          />
          <div className="mt-2">
            <DraftAssistant draft={description} context="comunicado" onApply={setDescription} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <label className={labelClass}>¿A quién le pedimos autorización?</label>
        {forceGradeMode ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 -mt-1">
            Solo puedes pedir autorizaciones a tus grados/secciones asignados, no a todo el colegio.
          </p>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAudienceMode('all')}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                audienceMode === 'all' ? 'bg-primary text-white shadow-glow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Todo el colegio
            </button>
            <button
              type="button"
              onClick={() => setAudienceMode('grade')}
              disabled={gradeLevelOptions.length === 0}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                audienceMode === 'grade' ? 'bg-primary text-white shadow-glow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Grado/sección específico
            </button>
          </div>
        )}

        {audienceMode === 'grade' && gradeLevelOptions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {gradeLevelOptions.map((grade) => (
              <button
                key={grade}
                type="button"
                onClick={() => setSelectedGrade(grade)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedGrade === grade ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {grade}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="w-full rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition shadow-glow disabled:opacity-60"
      >
        {saving ? 'Creando...' : 'Crear autorización'}
      </button>
    </form>
  )
}
