'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitAbsenceJustification } from './actions'
import {
  JUSTIFICATION_FILE_ACCEPT,
  JUSTIFICATION_STATUS_LABEL,
  type JustifiableAbsence,
} from '@/lib/attendance/justifications'

const statusBadge: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
  aceptada: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
  rechazada: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
}

function fechaLarga(iso: string) {
  // Fecha suelta (YYYY-MM-DD): se parte a mano en vez de pasarla por
  // new Date(), que la interpreta en UTC y la corre un día hacia atrás.
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('es-DO', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

/**
 * Justificación de ausencias — vista del tutor.
 *
 * Enviar una justificación NO cambia el estado de la asistencia: queda en
 * revisión hasta que el colegio la acepte. Eso se dice en pantalla, para
 * que nadie asuma que con mandarla ya quedó resuelto.
 */
export default function AbsenceJustifications({ absences }: { absences: JustifiableAbsence[] }) {
  const router = useRouter()
  const [abiertaId, setAbiertaId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [enviando, startTransition] = useTransition()

  if (absences.length === 0) return null

  const pendientes = absences.filter((a) => !a.justification || a.justification.status === 'rechazada')

  function handleSubmit(event: React.FormEvent<HTMLFormElement>, attendanceId: string) {
    event.preventDefault()
    setError(null)
    setExito(null)

    const formData = new FormData(event.currentTarget)
    formData.set('attendanceId', attendanceId)

    startTransition(async () => {
      const result = await submitAbsenceJustification(formData)
      if (!result.ok) {
        setError(result.error ?? 'No se pudo enviar la justificación.')
        return
      }
      setAbiertaId(null)
      setExito('Justificación enviada. El colegio la revisará.')
      router.refresh()
    })
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Justificar ausencias
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {pendientes.length > 0
            ? `Tienes ${pendientes.length} ${pendientes.length === 1 ? 'falta' : 'faltas'} sin justificar. Explica el motivo y, si tienes, adjunta el certificado médico o la carta.`
            : 'Todas las faltas de los últimos 30 días ya tienen una justificación enviada.'}
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      {exito && (
        <div role="status" className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          {exito}
        </div>
      )}

      <div className="space-y-3">
        {absences.map((absence) => {
          const j = absence.justification
          const puedeJustificar = !j || j.status === 'rechazada'

          return (
            <article
              key={absence.attendanceId}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{absence.studentName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                    {absence.status === 'tardanza' ? 'Tardanza' : 'Ausencia'} — {fechaLarga(absence.date)}
                    {absence.subjectName ? ` · ${absence.subjectName}` : ''}
                  </p>
                </div>
                {j && (
                  <span className={`text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full border shrink-0 ${statusBadge[j.status]}`}>
                    {JUSTIFICATION_STATUS_LABEL[j.status]}
                  </span>
                )}
              </div>

              {j && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 space-y-1">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">Lo que enviaste:</span> {j.reason}
                  </p>
                  {j.hasDocument && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">📎 Con documento adjunto</p>
                  )}
                  {j.reviewNote && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold">Respuesta del colegio:</span> {j.reviewNote}
                    </p>
                  )}
                </div>
              )}

              {puedeJustificar && abiertaId !== absence.attendanceId && (
                <button
                  type="button"
                  onClick={() => { setAbiertaId(absence.attendanceId); setError(null); setExito(null) }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary hover:opacity-90 text-white transition"
                >
                  {j?.status === 'rechazada' ? 'Enviar una nueva justificación' : 'Justificar esta falta'}
                </button>
              )}

              {abiertaId === absence.attendanceId && (
                <form onSubmit={(e) => handleSubmit(e, absence.attendanceId)} className="space-y-3">
                  <div>
                    <label htmlFor={`motivo-${absence.attendanceId}`} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Motivo de la ausencia
                    </label>
                    <textarea
                      id={`motivo-${absence.attendanceId}`}
                      name="reason"
                      required
                      rows={3}
                      maxLength={1000}
                      placeholder="Ej.: Amaneció con fiebre y lo llevamos al médico."
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label htmlFor={`archivo-${absence.attendanceId}`} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Documento (opcional) — certificado médico, carta…
                    </label>
                    <input
                      id={`archivo-${absence.attendanceId}`}
                      type="file"
                      name="file"
                      accept={JUSTIFICATION_FILE_ACCEPT}
                      className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 dark:file:text-slate-200"
                    />
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      Puedes tomarle una foto con el celular (JPG, PNG, HEIC de iPhone) o subir un PDF.
                      Máximo 10MB. Solo lo ve el personal del colegio.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={enviando}
                      className="text-xs font-semibold px-4 py-2 rounded-full bg-primary hover:opacity-90 text-white transition disabled:opacity-60"
                    >
                      {enviando ? 'Enviando…' : 'Enviar justificación'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbiertaId(null)}
                      disabled={enviando}
                      className="text-xs font-semibold px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
