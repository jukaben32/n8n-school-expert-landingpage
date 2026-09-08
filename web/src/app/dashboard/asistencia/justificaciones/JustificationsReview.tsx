'use client'

import { useState } from 'react'
import {
  getJustificationSignedUrl,
  reviewJustification,
  type PendingJustification,
} from './actions'

function fechaLarga(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('es-DO', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

/**
 * Bandeja de justificaciones de ausencia (personal).
 *
 * Mismo patrón que ReceiptsReview: el documento se abre con una URL
 * firmada de 5 minutos, y aceptar/rechazar exige una acción explícita del
 * staff con el caso ya visible en pantalla. Aceptar marca la asistencia
 * como 'justificado'; rechazar no toca nada de la asistencia.
 */
export default function JustificationsReview({ initial }: { initial: PendingJustification[] }) {
  const [items, setItems] = useState(initial)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<{ id: string; url: string } | null>(null)
  const [noteId, setNoteId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handlePreview(id: string) {
    setError(null)
    const url = await getJustificationSignedUrl(id)
    if (!url) {
      setError('No se pudo abrir el documento.')
      return
    }
    setPreviewUrl({ id, url })
  }

  async function handleReview(id: string, decision: 'aceptada' | 'rechazada') {
    setError(null)
    setBusyId(id)
    const result = await reviewJustification(id, decision, noteId === id ? note : '')
    setBusyId(null)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo guardar la revisión.')
      return
    }
    setItems((prev) => prev.filter((i) => i.id !== id))
    setNoteId(null)
    setNote('')
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
        <p className="text-4xl mb-3" aria-hidden="true">📭</p>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          No hay justificaciones pendientes de revisión.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {items.map((item) => (
        <article key={item.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {item.student_name}
                {item.grade_level && (
                  <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">{item.grade_level}</span>
                )}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {item.absence_status === 'tardanza' ? 'Tardanza' : 'Ausencia'} del {fechaLarga(item.absence_date)}
                {item.subject_name ? ` · ${item.subject_name}` : ''}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                Enviada por {item.guardian_name} · {new Date(item.created_at).toLocaleString('es-DO')}
              </p>
            </div>
            {item.has_document && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 shrink-0">
                📎 Con documento
              </span>
            )}
          </div>

          <p className="text-sm text-slate-700 dark:text-slate-200 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 whitespace-pre-wrap">
            {item.reason}
          </p>

          <div className="flex flex-wrap gap-2">
            {item.has_document && (
              <button
                type="button"
                onClick={() => handlePreview(item.id)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Ver documento
              </button>
            )}
            <button
              type="button"
              onClick={() => handleReview(item.id, 'aceptada')}
              disabled={busyId === item.id}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-green-600 hover:bg-green-700 text-white transition disabled:opacity-60"
            >
              Aceptar y marcar justificada
            </button>
            <button
              type="button"
              onClick={() => setNoteId(noteId === item.id ? null : item.id)}
              disabled={busyId === item.id}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-60"
            >
              No aceptar
            </button>
          </div>

          {previewUrl?.id === item.id && (
            <a href={previewUrl.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary dark:text-accent-light underline">
              Abrir el documento en una pestaña nueva (enlace válido por 5 minutos)
            </a>
          )}

          {noteId === item.id && (
            <div className="flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Motivo (se le envía al tutor por correo)"
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => handleReview(item.id, 'rechazada')}
                disabled={busyId === item.id}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-60"
              >
                Confirmar
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}
