'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { savePlanAction, deletePlanAction } from '../actions'
import DraftAssistant from '@/components/dashboard/DraftAssistant'

interface PlanFields {
  topic: string
  objective: string | null
  activities: string | null
  materials: string | null
  homework: string | null
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

export default function PlanForm({
  scheduleId,
  planDate,
  initial,
}: {
  scheduleId: string
  planDate: string
  initial: PlanFields | null
}) {
  const router = useRouter()
  const [topic, setTopic] = useState(initial?.topic ?? '')
  const [objective, setObjective] = useState(initial?.objective ?? '')
  const [activities, setActivities] = useState(initial?.activities ?? '')
  const [materials, setMaterials] = useState(initial?.materials ?? '')
  const [homework, setHomework] = useState(initial?.homework ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    if (!topic.trim()) {
      setError('El tema de la clase es obligatorio.')
      return
    }
    setSaving(true)
    const result = await savePlanAction({ scheduleId, planDate, topic, objective, activities, materials, homework })
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo guardar.')
      return
    }
    router.push(`/dashboard/planificacion?fecha=${planDate}`)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('¿Borrar la planificación de esta clase?')) return
    setSaving(true)
    await deletePlanAction(scheduleId, planDate)
    router.push(`/dashboard/planificacion?fecha=${planDate}`)
    router.refresh()
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div>
          <label htmlFor="topic" className={labelClass}>Tema de la clase</label>
          <input
            id="topic"
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ej. Introducción a las fracciones"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="objective" className={labelClass}>Objetivo de aprendizaje (opcional)</label>
          <textarea
            id="objective"
            rows={2}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="¿Qué debe poder hacer el estudiante al terminar?"
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label htmlFor="activities" className={labelClass}>Actividades (opcional)</label>
          <textarea
            id="activities"
            rows={3}
            value={activities}
            onChange={(e) => setActivities(e.target.value)}
            placeholder="Paso a paso de la clase..."
            className={`${inputClass} resize-none`}
          />
          <div className="mt-2">
            <DraftAssistant draft={activities} context="comunicado" onApply={setActivities} />
          </div>
        </div>

        <div>
          <label htmlFor="materials" className={labelClass}>Materiales (opcional)</label>
          <input
            id="materials"
            value={materials}
            onChange={(e) => setMaterials(e.target.value)}
            placeholder="Ej. Cuaderno, tijeras, cartulina"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="homework" className={labelClass}>Tarea (opcional)</label>
          <textarea
            id="homework"
            rows={2}
            value={homework}
            onChange={(e) => setHomework(e.target.value)}
            placeholder="¿Qué se llevan a hacer a casa?"
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="flex-1 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition shadow-glow disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar planificación'}
        </button>
        {initial && (
          <button
            type="button"
            disabled={saving}
            onClick={handleDelete}
            className="rounded-full border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-5 py-3 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-60"
          >
            Borrar
          </button>
        )}
      </div>
    </form>
  )
}
