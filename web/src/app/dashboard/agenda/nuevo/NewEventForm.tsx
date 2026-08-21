'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createEventAction } from '../actions'
import DraftAssistant from '@/components/dashboard/DraftAssistant'

interface NewEventFormProps {
  gradeLevelOptions: string[]
  /** true para 'teacher': no puede dirigir a todo el colegio, solo a su grado. */
  forceGradeMode?: boolean
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'

const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

const categoryOptions = [
  { value: 'general', label: 'General' },
  { value: 'academico', label: 'Académico' },
  { value: 'feriado', label: 'Feriado' },
  { value: 'reunion', label: 'Reunión' },
  { value: 'extracurricular', label: 'Extracurricular' },
  { value: 'evaluacion', label: 'Evaluación' },
]

export default function NewEventForm({ gradeLevelOptions, forceGradeMode = false }: NewEventFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState('general')
  const [audienceMode, setAudienceMode] = useState<'all' | 'grade'>(forceGradeMode ? 'grade' : 'all')
  const [selectedGrade, setSelectedGrade] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    if (!title.trim() || !eventDate) {
      setError('El título y la fecha son obligatorios.')
      return
    }
    if (audienceMode === 'grade' && !selectedGrade) {
      setError('Elige un grado/sección, o cambia a "Todo el colegio".')
      return
    }
    setSaving(true)

    const result = await createEventAction({
      title,
      description,
      eventDate,
      startTime,
      endTime,
      location,
      category,
      gradeLevel: audienceMode === 'grade' ? selectedGrade : '',
    })

    if (!result.ok) {
      setError(result.error ?? 'No se pudo guardar el evento. Intenta de nuevo.')
      setSaving(false)
      return
    }

    router.push('/dashboard/agenda')
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
            placeholder="Ej. Reunión general de padres"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="description" className={labelClass}>Descripción (opcional)</label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalles del evento..."
            className={`${inputClass} resize-none`}
          />
          <div className="mt-2">
            <DraftAssistant draft={description} context="comunicado" onApply={setDescription} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="eventDate" className={labelClass}>Fecha</label>
            <input
              id="eventDate"
              type="date"
              required
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="category" className={labelClass}>Categoría</label>
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {categoryOptions.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startTime" className={labelClass}>Hora de inicio (opcional)</label>
            <input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="endTime" className={labelClass}>Hora de fin (opcional)</label>
            <input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label htmlFor="location" className={labelClass}>Lugar (opcional)</label>
          <input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ej. Salón de usos múltiples"
            className={inputClass}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <label className={labelClass}>¿Para quién es?</label>
        {forceGradeMode ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 -mt-1">
            Solo puedes crear eventos para tus grados/secciones asignados, no para todo el colegio.
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
              onClick={() => setAudienceMode('grade')}
              disabled={gradeLevelOptions.length === 0}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                audienceMode === 'grade'
                  ? 'bg-primary text-white shadow-glow'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Grado/sección específico
            </button>
          </div>
        )}

        {audienceMode === 'grade' && (
          gradeLevelOptions.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {gradeLevelOptions.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setSelectedGrade(grade)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    selectedGrade === grade
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
              Todavía no hay grados/secciones asignados a ningún estudiante.
            </p>
          )
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <button
        type="button"
        id="btn-guardar-evento"
        disabled={saving}
        onClick={handleSave}
        className="w-full rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition shadow-glow disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? 'Guardando...' : 'Guardar evento'}
      </button>
    </form>
  )
}
