'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addCandidate, removeCandidate, setPollStatus, castVote } from '../actions'

interface Candidate { id: string; display_name: string; student_id: string | null; sort_order: number }
interface Position { id: string; name: string; sort_order: number; poll_candidates: Candidate[] }
interface Student { id: string; name: string }

interface Props {
  poll: { id: string; title: string; description: string | null; gradeLevel: string | null; status: string }
  students: Student[]
  positions: Position[]
  votedStudentIds: string[]
  results: { position_name: string; candidate_name: string; votes: number }[]
  reconciliation: { voters: number; position_name: string; ballots: number }[]
  puedeGestionar: boolean
}

/**
 * Urna del aula. El profesor elige al estudiante del padrón, le pasa el
 * dispositivo, el estudiante marca su voto y se guarda. El padrón se ve
 * (quién ya votó), pero el voto nunca queda asociado a nadie.
 */
export default function VotacionPanel({
  poll, students, positions, votedStudentIds, results, reconciliation, puedeGestionar,
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [votingStudent, setVotingStudent] = useState<Student | null>(null)
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [newCandidate, setNewCandidate] = useState<Record<string, string>>({})

  const voted = new Set(votedStudentIds)
  const pendientes = students.filter((s) => !voted.has(s.id))
  const abierta = poll.status === 'abierta'
  const cerrada = poll.status === 'cerrada'

  async function handleAddCandidate(positionId: string) {
    const studentId = newCandidate[positionId]
    if (!studentId) return
    const student = students.find((s) => s.id === studentId)
    if (!student) return
    setBusy(true); setError(null)
    const result = await addCandidate(positionId, studentId, student.name)
    setBusy(false)
    if (!result.ok) { setError(result.error ?? 'No se pudo agregar.'); return }
    setNewCandidate((prev) => ({ ...prev, [positionId]: '' }))
    router.refresh()
  }

  async function handleRemoveCandidate(candidateId: string) {
    setBusy(true); setError(null)
    const result = await removeCandidate(candidateId)
    setBusy(false)
    if (!result.ok) { setError(result.error ?? 'No se pudo quitar.'); return }
    router.refresh()
  }

  async function handleStatus(status: 'abierta' | 'cerrada') {
    const msg = status === 'abierta'
      ? '¿Abrir la votación? A partir de ahora los estudiantes pueden votar.'
      : '¿Cerrar la votación? Ya no se podrán registrar más votos y se publicará el resultado.'
    if (!confirm(msg)) return
    setBusy(true); setError(null)
    const result = await setPollStatus(poll.id, status)
    setBusy(false)
    if (!result.ok) { setError(result.error ?? 'No se pudo cambiar el estado.'); return }
    router.refresh()
  }

  async function handleCastVote() {
    if (!votingStudent) return
    const missing = positions.filter((p) => !choices[p.id])
    if (missing.length > 0) {
      setError(`Falta elegir: ${missing.map((m) => m.name).join(', ')}`)
      return
    }
    setBusy(true); setError(null)
    const result = await castVote(
      poll.id,
      votingStudent.id,
      positions.map((p) => ({ positionId: p.id, candidateId: choices[p.id] }))
    )
    setBusy(false)
    if (!result.ok) { setError(result.error ?? 'No se pudo registrar el voto.'); return }
    setVotingStudent(null)
    setChoices({})
    router.refresh()
  }

  // ── Pantalla de votación (el estudiante marca su voto) ──────────────────
  if (votingStudent) {
    return (
      <div className="dash-card p-6 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">Votando</p>
          <h2 className="text-xl font-bold" style={{ color: 'var(--dash-text)' }}>{votingStudent.name}</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--dash-text-faint)' }}>
            Tu voto es secreto: el sistema guarda que ya votaste, pero no por quién.
          </p>
        </div>

        {positions.map((p) => (
          <div key={p.id} className="space-y-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>{p.name}</p>
            <div className="grid gap-2">
              {p.poll_candidates.length === 0 ? (
                <p className="text-xs text-amber-600">Este cargo no tiene candidatos.</p>
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

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button" disabled={busy} onClick={handleCastVote}
            className="flex-1 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition disabled:opacity-60"
          >
            {busy ? 'Guardando…' : 'Depositar voto'}
          </button>
          <button
            type="button" onClick={() => { setVotingStudent(null); setChoices({}); setError(null) }}
            className="rounded-full border border-slate-200 dark:border-slate-700 px-6 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">{poll.title}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {poll.gradeLevel} · {abierta ? 'Votación abierta' : cerrada ? 'Votación cerrada' : 'Borrador'}
        </p>
        {poll.description && <p className="text-sm text-slate-500 mt-1">{poll.description}</p>}
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {/* Controles de dirección */}
      {puedeGestionar && !cerrada && (
        <div className="flex gap-2">
          {!abierta ? (
            <button type="button" disabled={busy} onClick={() => handleStatus('abierta')} className="dash-btn-primary text-sm px-5 py-2.5">
              Abrir votación
            </button>
          ) : (
            <button
              type="button" disabled={busy} onClick={() => handleStatus('cerrada')}
              className="rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 transition"
            >
              Cerrar y publicar resultado
            </button>
          )}
        </div>
      )}

      {/* Candidatos -- los carga el profesor del curso, antes de abrir */}
      {!cerrada && (
        <section className="dash-card p-5 space-y-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>Candidatos por cargo</h2>
          {positions.map((p) => (
            <div key={p.id} className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dash-text-muted)' }}>{p.name}</p>
              {p.poll_candidates.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--dash-text-faint)' }}>Sin candidatos todavía.</p>
              ) : (
                <ul className="space-y-1">
                  {p.poll_candidates.map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-sm" style={{ color: 'var(--dash-text)' }}>
                      <span>{c.display_name}</span>
                      {!abierta && (
                        <button type="button" disabled={busy} onClick={() => handleRemoveCandidate(c.id)} className="text-xs text-red-500 hover:text-red-600">
                          Quitar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!abierta && (
                <div className="flex gap-2">
                  <select
                    value={newCandidate[p.id] ?? ''}
                    onChange={(e) => setNewCandidate((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    className="flex-1 rounded-lg border border-slate-200 bg-white text-sm px-3 py-1.5 text-slate-700"
                  >
                    <option value="">Elegir estudiante…</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button
                    type="button" disabled={busy || !newCandidate[p.id]} onClick={() => handleAddCandidate(p.id)}
                    className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 transition disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Padrón / urna */}
      {abierta && (
        <section className="dash-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>Urna del aula</h2>
            <span className="text-xs" style={{ color: 'var(--dash-text-muted)' }}>
              {voted.size} de {students.length} ya votaron
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--dash-text-faint)' }}>
            Elige al estudiante, pásale el dispositivo y que marque su voto. Nadie puede votar dos veces.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {pendientes.map((s) => (
              <button
                key={s.id} type="button" onClick={() => { setVotingStudent(s); setChoices({}); setError(null) }}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-left text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-primary/50 transition"
              >
                {s.name}
              </button>
            ))}
          </div>
          {pendientes.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--dash-accent)' }}>Todo el curso ya votó.</p>
          )}
        </section>
      )}

      {/* Acta de resultados */}
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

          <div className="border-t pt-3" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--dash-text-muted)' }}>
              Cuadre del acta
            </p>
            {reconciliation.map((rec) => (
              <div key={rec.position_name} className="flex items-center justify-between text-xs" style={{ color: 'var(--dash-text-faint)' }}>
                <span>{rec.position_name}</span>
                <span>
                  {rec.ballots} votos / {rec.voters} votantes{' '}
                  {rec.ballots === rec.voters ? '✓' : '⚠ no cuadra'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
