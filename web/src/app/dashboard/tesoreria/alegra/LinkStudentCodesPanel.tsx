'use client'

import { useState, useTransition } from 'react'
import { linkAlegraStudentCodes, confirmStudentCode } from './actions'

/**
 * Vincula cada estudiante con su matrícula de Alegra. Con la matrícula
 * guardada, la conciliación empareja por matrícula y deja de depender de
 * cómo se escribió el nombre en el POS. Nunca cambia nombres: manda el de
 * la plataforma (regla del colegio).
 */

type Suggestion = { code: string; alegraName: string; candidates: { studentId: string; studentName: string }[] }
type Link = { studentName: string; code: string; alegraName: string; level: string }

const RECARGA = 'No se pudo completar. Recarga la página (F5) e intenta de nuevo; no se guardó nada a medias.'

export default function LinkStudentCodesPanel({ withoutCode, total }: { withoutCode: number; total: number }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [links, setLinks] = useState<Link[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [confirmed, setConfirmed] = useState<Record<string, string>>({})

  const run = () => {
    setError(null)
    startTransition(async () => {
      try {
        const r = await linkAlegraStudentCodes()
        if (!r.ok) { setError(r.error ?? RECARGA); return }
        setLinks(r.links ?? [])
        setSuggestions(r.suggestions ?? [])
        setSummary(
          `${r.applied ?? 0} matrículas vinculadas ahora · ${r.alreadyLinked ?? 0} ya estaban vinculadas · ` +
          `${(r.suggestions ?? []).length} para confirmar · ${r.unmatched ?? 0} contactos de Alegra sin estudiante parecido`
        )
        if (r.error) setError(r.error)
      } catch {
        setError(RECARGA)
      }
    })
  }

  const confirm = (s: Suggestion, studentId: string) => {
    setError(null)
    startTransition(async () => {
      try {
        const r = await confirmStudentCode(studentId, s.code)
        if (!r.ok) { setError(r.error ?? RECARGA); return }
        setConfirmed((prev) => ({ ...prev, [s.code]: studentId }))
      } catch {
        setError(RECARGA)
      }
    })
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 text-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Matrículas de Alegra</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {withoutCode === 0
              ? `Los ${total} estudiantes inscritos tienen su matrícula vinculada: la conciliación empareja por matrícula.`
              : `${withoutCode} de ${total} estudiantes inscritos aún no tienen su matrícula de Alegra vinculada. Sin ella, sus cobros dependen de cómo se escribió el nombre.`}
            {' '}Se vincula sola cada noche; los nombres de la plataforma nunca se cambian.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded-md bg-[#1a5f7a] px-3 py-2 text-sm font-medium text-white hover:bg-[#154d63] disabled:opacity-60"
        >
          {pending ? 'Vinculando…' : 'Vincular matrículas ahora'}
        </button>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {summary && <p className="text-sm text-emerald-700">{summary}</p>}

      {links.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600">Ver las {links.length} vinculadas</summary>
          <ul className="mt-2 space-y-1 text-slate-700">
            {links.map((l) => (
              <li key={l.code}>
                {l.studentName} — <span className="font-mono">{l.code}</span>
                {l.level !== 'exacto' && <span className="text-slate-500"> (en Alegra: «{l.alegraName}»)</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-amber-800">
            Estos contactos de Alegra se parecen a un estudiante pero no con total certeza. Confirma a quién corresponde
            cada matrícula (el nombre de la plataforma se queda como está):
          </p>
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li key={`${s.code}-${s.alegraName}`} className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-slate-800">
                <div>
                  En Alegra: <strong>{s.alegraName}</strong> · matrícula <span className="font-mono">{s.code}</span>
                </div>
                {confirmed[s.code] ? (
                  <div className="text-emerald-700 mt-1">Vinculada ✓</div>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {s.candidates.map((c) => (
                      <button
                        key={c.studentId}
                        type="button"
                        disabled={pending}
                        onClick={() => confirm(s, c.studentId)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                      >
                        Es {c.studentName}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
