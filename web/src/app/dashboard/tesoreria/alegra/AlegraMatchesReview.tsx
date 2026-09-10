'use client'

import { useState, useTransition } from 'react'
import { resolveAlegraMatch, discardAlegraMatch, runAlegraSyncNow } from './actions'

/**
 * Bandeja de revisión de la conciliación con Alegra.
 *
 * Aquí llega solo lo que el motor NO se atrevió a cargar solo. Mismo
 * principio que las bandejas de fichas escaneadas y de comprobantes de
 * pago: nada de dinero entra a Cuentas por Cobrar sin que una persona lo
 * vea. En la conciliación real del 2026-09-09, 8 de 34 cobros cayeron en
 * esta categoría.
 */

export interface MatchCandidate {
  studentId: string
  name: string
  gradeLevel: string | null
  via: string
}

export interface PendingMatch {
  id: string
  alegra_number: string | null
  alegra_date: string
  alegra_client_name: string | null
  alegra_client_identification: string | null
  alegra_client_id_type: string | null
  alegra_note: string | null
  alegra_payment_method: string | null
  amount: number
  assigned_amount: number
  reason: string
  candidates: MatchCandidate[]
}

export interface StudentOption {
  id: string
  name: string
  gradeLevel: string | null
}

const REASON_LABELS: Record<string, string> = {
  sin_emparejar: 'No se encontró al estudiante',
  ambiguo: 'Varios estudiantes coinciden',
  aproximado: 'El nombre no calza exacto',
  posible_duplicado: 'Puede que ya esté registrado',
  conjunto: 'Comprobante a nombre del tutor (varios hijos)',
}

const REASON_HELP: Record<string, string> = {
  sin_emparejar: 'Ningún estudiante inscrito coincide por matrícula ni por nombre. Puede que falte darlo de alta.',
  ambiguo: 'Más de un estudiante coincide. Elige cuál antes de registrar.',
  aproximado: 'El nombre se parece pero no es idéntico (una letra, un apellido). Confírmalo antes de registrar.',
  posible_duplicado: 'Ese estudiante ya tiene un cobro del mismo monto y la misma fecha sin referencia. Revisa que no sea el mismo.',
  conjunto: 'El comprobante fiscal va a nombre del tutor y cubre a varios hijos. Regístralo una vez por hijo, con el monto de cada uno.',
}

const REASON_TONE: Record<string, string> = {
  sin_emparejar: 'bg-red-50 text-red-800 border-red-200',
  ambiguo: 'bg-amber-50 text-amber-800 border-amber-200',
  aproximado: 'bg-amber-50 text-amber-800 border-amber-200',
  posible_duplicado: 'bg-orange-50 text-orange-800 border-orange-200',
  conjunto: 'bg-sky-50 text-sky-800 border-sky-200',
}

const formatDOP = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' })

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })
}

function MatchCard({ match, students }: { match: PendingMatch; students: StudentOption[] }) {
  const restante = Math.round((match.amount - match.assigned_amount) * 100) / 100
  const [studentId, setStudentId] = useState(match.candidates.length === 1 ? match.candidates[0].studentId : '')
  const [amount, setAmount] = useState(String(restante))
  const [note, setNote] = useState('')
  const [discarding, setDiscarding] = useState(false)
  const [discardNote, setDiscardNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = () => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await resolveAlegraMatch(match.id, studentId, Number(amount), note)
        if (!result.ok) setError(result.error ?? 'No se pudo registrar.')
      } catch {
        setError('El servidor no respondió. Si la sesión venció, vuelve a entrar en otra pestaña e inténtalo de nuevo.')
      }
    })
  }

  const discard = () => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await discardAlegraMatch(match.id, discardNote)
        if (!result.ok) setError(result.error ?? 'No se pudo descartar.')
      } catch {
        setError('El servidor no respondió. Si la sesión venció, vuelve a entrar en otra pestaña e inténtalo de nuevo.')
      }
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{match.alegra_client_name ?? 'Sin nombre en Alegra'}</p>
          <p className="text-xs text-slate-500">
            {formatDate(match.alegra_date)}
            {match.alegra_number && <> · e-CF {match.alegra_number}</>}
            {match.alegra_client_identification && (
              <> · {match.alegra_client_id_type === 'CED' ? 'cédula' : 'matrícula'} {match.alegra_client_identification}</>
            )}
            {match.alegra_payment_method && <> · {match.alegra_payment_method}</>}
          </p>
          {match.alegra_note && <p className="text-xs text-slate-600 mt-1 italic">&ldquo;{match.alegra_note}&rdquo;</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-900">{formatDOP.format(restante)}</p>
          {match.assigned_amount > 0 && (
            <p className="text-xs text-slate-500">de {formatDOP.format(match.amount)} · ya atribuido {formatDOP.format(match.assigned_amount)}</p>
          )}
        </div>
      </div>

      <div className={`rounded border px-3 py-2 text-xs ${REASON_TONE[match.reason] ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}>
        <span className="font-semibold">{REASON_LABELS[match.reason] ?? match.reason}.</span>{' '}
        {REASON_HELP[match.reason] ?? ''}
      </div>

      {match.candidates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {match.candidates.map((c) => (
            <button
              key={c.studentId}
              type="button"
              onClick={() => setStudentId(c.studentId)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                studentId === c.studentId
                  ? 'border-[#1a5f7a] bg-[#1a5f7a] text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-[#1a5f7a]'
              }`}
            >
              {c.name}{c.gradeLevel ? ` · ${c.gradeLevel}` : ''}
            </button>
          ))}
        </div>
      )}

      {discarding ? (
        <div className="space-y-2">
          <input
            type="text"
            value={discardNote}
            onChange={(e) => setDiscardNote(e.target.value)}
            placeholder="¿Por qué se descarta? (ej. ya se registró a mano, no es mensualidad)"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button" onClick={discard} disabled={pending}
              className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? 'Descartando…' : 'Confirmar descarte'}
            </button>
            <button
              type="button" onClick={() => setDiscarding(false)}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_2fr_auto] sm:items-end">
          <label className="text-xs text-slate-600">
            Estudiante
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
            >
              <option value="">Elegir…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.gradeLevel ? ` — ${s.gradeLevel}` : ''}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Monto
            <input
              type="number" step="0.01" min="0" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            Nota (opcional)
            <input
              type="text" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. corresponde al hermano mayor"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button" onClick={submit} disabled={pending || !studentId}
              className="rounded bg-[#1a5f7a] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? 'Registrando…' : 'Registrar'}
            </button>
            <button
              type="button" onClick={() => setDiscarding(true)}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-600"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  )
}

export default function AlegraMatchesReview({ matches, students }: { matches: PendingMatch[]; students: StudentOption[] }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const syncNow = () => {
    setMessage(null); setError(null)
    startTransition(async () => {
      try {
        const result = await runAlegraSyncNow()
        if (result.ok) setMessage(result.resumen ?? 'Conciliación completada.')
        else setError(result.error ?? 'No se pudo conciliar.')
      } catch {
        setError('El servidor no respondió. Si la sesión venció, vuelve a entrar en otra pestaña e inténtalo de nuevo.')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button" onClick={syncNow} disabled={pending}
          className="rounded bg-[#1a5f7a] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Conciliando…' : 'Conciliar ahora'}
        </button>
        <span className="text-xs text-slate-500">
          La conciliación corre sola a las 7:00 pm, de lunes a viernes.
        </span>
      </div>

      {message && <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      {matches.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          No hay cobros de Alegra esperando revisión.
        </p>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => <MatchCard key={m.id} match={m} students={students} />)}
        </div>
      )}
    </div>
  )
}
