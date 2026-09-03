'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { castOwnVote } from '../actions'

interface Candidate { id: string; display_name: string; sort_order: number }
interface Position { id: string; name: string; sort_order: number; poll_candidates: Candidate[] }

interface Props {
  poll: { id: string; title: string; description: string | null; gradeLevel: string | null; status: string }
  positions: Position[]
  yaVoto: boolean
  results: { position_name: string; candidate_name: string; votes: number }[]
}

/**
 * La papeleta del estudiante — vota desde su propia cuenta.
 *
 * No se le manda ningún identificador al servidor: quién vota lo resuelve
 * la base de datos a partir de la sesión, así que nadie puede votar en
 * nombre de otro. Y como la urna no guarda ni votante ni hora, tampoco
 * hay forma de reconstruir después qué votó cada quien.
 */
export default function EstudianteVotacionPanel({ poll, positions, yaVoto, results }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [choices, setChoices] = useState<Record<string, string>>({})

  const abierta = poll.status === 'abierta'
  const cerrada = poll.status === 'cerrada'

  async function handleVote() {
    const faltan = positions.filter((p) => !choices[p.id])
    if (faltan.length > 0) {
      setError(`Falta elegir: ${faltan.map((f) => f.name).join(', ')}`)
      return
    }
    if (!confirm('¿Depositar tu voto? Una vez depositado no se puede cambiar.')) return

    setBusy(true)
    setError(null)
    const result = await castOwnVote(
      poll.id,
      positions.map((p) => ({ positionId: p.id, candidateId: choices[p.id] }))
    )
    setBusy(false)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo registrar tu voto.')
      return
    }
    setChoices({})
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">{poll.title}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {poll.gradeLevel} · {abierta ? 'Votación abierta' : cerrada ? 'Votación cerrada' : 'Aún no ha abierto'}
        </p>
        {poll.description && <p className="text-sm text-slate-500 mt-1">{poll.description}</p>}
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {abierta && yaVoto && (
        <div className="dash-card p-8 text-center">
          <p className="text-4xl mb-2" aria-hidden="true">🗳️</p>
          <p className="font-semibold" style={{ color: 'var(--dash-text)' }}>Tu voto ya está en la urna</p>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-text-muted)' }}>
            Nadie puede ver por quién votaste, ni siquiera la dirección. El resultado se publica aquí mismo
            cuando se cierre la votación.
          </p>
        </div>
      )}

      {abierta && !yaVoto && (
        <div className="dash-card p-5 space-y-5">
          <p className="text-xs" style={{ color: 'var(--dash-text-faint)' }}>
            Elige un candidato por cargo. Tu voto es secreto: el sistema guarda que votaste, pero no por quién.
          </p>

          {positions.map((p) => (
            <div key={p.id} className="space-y-2">
              <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>{p.name}</p>
              <div className="grid gap-2">
                {p.poll_candidates.length === 0 ? (
                  <p className="text-xs text-amber-600">Este cargo todavía no tiene candidatos.</p>
                ) : (
                  p.poll_candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChoices((prev) => ({ ...prev, [p.id]: c.id }))}
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                        choices[p.id] === c.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary/40'
                      }`}
                    >
                      {c.display_name}
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            disabled={busy}
            onClick={handleVote}
            className="w-full rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition disabled:opacity-60"
          >
            {busy ? 'Depositando…' : 'Depositar mi voto'}
          </button>
        </div>
      )}

      {!abierta && !cerrada && (
        <div className="dash-card border-dashed p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
            La votación todavía no ha abierto. Tu profesor te avisará.
          </p>
        </div>
      )}

      {cerrada && (
        <section className="dash-card p-5 space-y-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>Resultado</h2>
          {Object.entries(
            results.reduce((acc, r) => {
              (acc[r.position_name] ??= []).push(r)
              return acc
            }, {} as Record<string, typeof results>)
          ).map(([positionName, rows]) => (
            <div key={positionName} className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dash-text-muted)' }}>{positionName}</p>
              {rows.map((r, i) => (
                <div key={r.candidate_name} className="flex items-center justify-between text-sm">
                  <span style={{ color: i === 0 ? 'var(--dash-accent)' : 'var(--dash-text)' }}>
                    {i === 0 ? '★ ' : ''}{r.candidate_name}
                  </span>
                  <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>{r.votes} votos</span>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
