'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createVotacion, createEncuesta } from './actions'

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

/** Cargos típicos de una junta directiva de curso -- editables. */
const CARGOS_POR_DEFECTO = ['Presidente', 'Secretario', 'Vocal']

type Kind = 'opcion' | 'escala' | 'texto'
interface DraftQuestion { key: string; text: string; kind: Kind; options: string }

function newQuestion(): DraftQuestion {
  return { key: crypto.randomUUID(), text: '', kind: 'opcion', options: 'Sí, No' }
}

export default function NewPollForm({ gradeLevelOptions }: { gradeLevelOptions: string[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tipo, setTipo] = useState<'votacion' | 'encuesta'>('votacion')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  // Votación
  const [gradeLevel, setGradeLevel] = useState(gradeLevelOptions[0] ?? '')
  const [cargos, setCargos] = useState(CARGOS_POR_DEFECTO.join(', '))

  // Encuesta
  const [audience, setAudience] = useState<'staff' | 'familias' | 'ambos'>('ambos')
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion()])

  function updateQuestion(key: string, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const result =
      tipo === 'votacion'
        ? await createVotacion({
            title,
            description,
            gradeLevel,
            positions: cargos.split(',').map((c) => c.trim()).filter(Boolean),
          })
        : await createEncuesta({
            title,
            description,
            audience,
            questions: questions.map((q) => ({
              text: q.text,
              kind: q.kind,
              options: q.options.split(',').map((o) => o.trim()).filter(Boolean),
            })),
          })

    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo crear.')
      return
    }
    setOpen(false)
    setTitle('')
    setDescription('')
    setQuestions([newQuestion()])
    router.refresh()
    if (result.pollId) router.push(`/dashboard/encuestas/${result.pollId}`)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="dash-btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5"
      >
        + Nueva encuesta o votación
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="dash-card p-5 space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTipo('votacion')}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            tipo === 'votacion' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          Votación de junta directiva
        </button>
        <button
          type="button"
          onClick={() => setTipo('encuesta')}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            tipo === 'encuesta' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          Encuesta
        </button>
      </div>

      <div>
        <label htmlFor="pollTitle" className={labelClass}>Título</label>
        <input
          id="pollTitle" required value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder={tipo === 'votacion' ? 'Ej. Junta directiva 2026-2027' : 'Ej. ¿Qué te parece la plataforma?'}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="pollDesc" className={labelClass}>Descripción (opcional)</label>
        <input id="pollDesc" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </div>

      {tipo === 'votacion' ? (
        <>
          <div>
            <label htmlFor="pollGrade" className={labelClass}>Curso</label>
            <select id="pollGrade" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className={inputClass}>
              {gradeLevelOptions.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pollCargos" className={labelClass}>Cargos a elegir</label>
            <input id="pollCargos" value={cargos} onChange={(e) => setCargos(e.target.value)} className={inputClass} />
            <p className="text-xs text-slate-400 mt-1.5">
              Sepáralos con comas. Después el profesor del curso carga los candidatos de cada cargo.
            </p>
          </div>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="pollAudience" className={labelClass}>¿A quién va dirigida?</label>
            <select
              id="pollAudience" value={audience}
              onChange={(e) => setAudience(e.target.value as 'staff' | 'familias' | 'ambos')}
              className={inputClass}
            >
              <option value="ambos">Personal y familias</option>
              <option value="staff">Solo el personal</option>
              <option value="familias">Solo las familias</option>
            </select>
          </div>

          <div className="space-y-3">
            <p className={labelClass}>Preguntas</p>
            {questions.map((q, i) => (
              <div key={q.key} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Pregunta {i + 1}</span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuestions((prev) => prev.filter((x) => x.key !== q.key))}
                      className="text-xs text-red-500 hover:text-red-600"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <input
                  value={q.text} onChange={(e) => updateQuestion(q.key, { text: e.target.value })}
                  placeholder="Escribe la pregunta" className={inputClass}
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={q.kind}
                    onChange={(e) => updateQuestion(q.key, { kind: e.target.value as Kind })}
                    className={inputClass}
                  >
                    <option value="opcion">Opciones</option>
                    <option value="escala">Escala 1 a 5</option>
                    <option value="texto">Respuesta libre</option>
                  </select>
                  {q.kind === 'opcion' && (
                    <input
                      value={q.options} onChange={(e) => updateQuestion(q.key, { options: e.target.value })}
                      placeholder="Sí, No" className={inputClass}
                    />
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setQuestions((prev) => [...prev, newQuestion()])}
              className="w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-2 text-sm font-semibold text-slate-500 hover:border-primary/40 transition"
            >
              + Agregar pregunta
            </button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit" disabled={saving}
          className="flex-1 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 text-sm transition disabled:opacity-60"
        >
          {saving ? 'Creando…' : 'Crear'}
        </button>
        <button
          type="button" onClick={() => setOpen(false)}
          className="rounded-full border border-slate-200 dark:border-slate-700 px-6 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 transition"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
