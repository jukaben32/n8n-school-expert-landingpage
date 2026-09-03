'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setPollStatus, submitEncuesta } from '../actions'

interface Question { id: string; text: string; kind: 'opcion' | 'escala' | 'texto'; options: string[] | null; sort_order: number }

interface Props {
  poll: { id: string; title: string; description: string | null; audience: string | null; status: string }
  questions: Question[]
  alreadyAnswered: boolean
  results: { question_text: string; question_kind: string; answer: string | null; responses: number }[]
  puedeGestionar: boolean
}

const AUDIENCE_LABELS: Record<string, string> = {
  staff: 'el personal',
  familias: 'las familias',
  ambos: 'el personal y las familias',
}

export default function EncuestaPanel({ poll, questions, alreadyAnswered, results, puedeGestionar }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const abierta = poll.status === 'abierta'
  const cerrada = poll.status === 'cerrada'

  async function handleStatus(status: 'abierta' | 'cerrada') {
    const msg = status === 'abierta'
      ? '¿Abrir la encuesta? A partir de ahora se puede responder.'
      : '¿Cerrar la encuesta? Ya no se aceptarán más respuestas y se publicarán los resultados.'
    if (!confirm(msg)) return
    setBusy(true); setError(null)
    const result = await setPollStatus(poll.id, status)
    setBusy(false)
    if (!result.ok) { setError(result.error ?? 'No se pudo cambiar el estado.'); return }
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const faltan = questions.filter((q) => !answers[q.id]?.trim())
    if (faltan.length > 0) { setError('Responde todas las preguntas.'); return }

    setBusy(true); setError(null)
    const result = await submitEncuesta(
      poll.id,
      questions.map((q) => ({
        questionId: q.id,
        option: q.kind === 'opcion' ? answers[q.id] : undefined,
        scale: q.kind === 'escala' ? Number(answers[q.id]) : undefined,
        text: q.kind === 'texto' ? answers[q.id] : undefined,
      }))
    )
    setBusy(false)
    if (!result.ok) { setError(result.error ?? 'No se pudo enviar.'); return }
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">{poll.title}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Dirigida a {AUDIENCE_LABELS[poll.audience ?? ''] ?? poll.audience} ·{' '}
          {abierta ? 'Abierta' : cerrada ? 'Cerrada' : 'Borrador'}
        </p>
        {poll.description && <p className="text-sm text-slate-500 mt-1">{poll.description}</p>}
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {puedeGestionar && !cerrada && (
        <div className="flex gap-2">
          {!abierta ? (
            <button type="button" disabled={busy} onClick={() => handleStatus('abierta')} className="dash-btn-primary text-sm px-5 py-2.5">
              Abrir encuesta
            </button>
          ) : (
            <button
              type="button" disabled={busy} onClick={() => handleStatus('cerrada')}
              className="rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 transition"
            >
              Cerrar y publicar resultados
            </button>
          )}
        </div>
      )}

      {/* Responder */}
      {abierta && (
        alreadyAnswered ? (
          <div className="dash-card p-6 text-center">
            <p className="text-4xl mb-2" aria-hidden="true">✅</p>
            <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
              Ya respondiste esta encuesta. Gracias.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="dash-card p-5 space-y-5">
            {questions.map((q, i) => (
              <div key={q.id} className="space-y-2">
                <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>{i + 1}. {q.text}</p>

                {q.kind === 'opcion' && (
                  <div className="grid gap-2">
                    {(q.options ?? []).map((opt) => (
                      <button
                        key={opt} type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                        className={`rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition ${
                          answers[q.id] === opt
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary/40'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {q.kind === 'escala' && (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n} type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: String(n) }))}
                        className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition ${
                          answers[q.id] === String(n)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary/40'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}

                {q.kind === 'texto' && (
                  <textarea
                    rows={3}
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                )}
              </div>
            ))}

            <button
              type="submit" disabled={busy}
              className="w-full rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition disabled:opacity-60"
            >
              {busy ? 'Enviando…' : 'Enviar respuestas'}
            </button>
          </form>
        )
      )}

      {/* Resultados */}
      {cerrada && (
        <section className="dash-card p-5 space-y-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>Resultados</h2>
          {Object.entries(
            results.reduce((acc, r) => {
              (acc[r.question_text] ??= []).push(r)
              return acc
            }, {} as Record<string, typeof results>)
          ).map(([questionText, rows]) => {
            const total = rows.reduce((s, r) => s + Number(r.responses), 0)
            return (
              <div key={questionText} className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dash-text-muted)' }}>{questionText}</p>
                {rows.filter((r) => r.answer !== null).map((r) => {
                  const pct = total > 0 ? Math.round((Number(r.responses) / total) * 100) : 0
                  return (
                    <div key={r.answer} className="space-y-0.5">
                      <div className="flex items-center justify-between text-sm">
                        <span style={{ color: 'var(--dash-text)' }}>{r.answer}</span>
                        <span style={{ color: 'var(--dash-text-muted)' }}>{r.responses} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'rgba(150,225,196,.14)' }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: 'var(--dash-accent)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
