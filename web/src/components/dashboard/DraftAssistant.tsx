'use client'

import { useState } from 'react'
import { polishDraftAction } from '@/lib/ai/actions'
import type { DraftContext } from '@/lib/ai/polishStaffMessage'

/**
 * DraftAssistant — botón "✨ Mejorar redacción" para comunicados y
 * mensajes directos. El personal escribe su borrador tal cual (sin
 * cuidar ortografía/estilo) en el campo normal del formulario; este
 * componente manda ese borrador a Claude y muestra el resultado
 * reescrito en un cuadro aparte. El personal decide si usarlo
 * ("Usar este texto" reemplaza el campo original) o descartarlo.
 *
 * No reemplaza el texto automáticamente -- el personal siempre revisa
 * antes de que se use.
 */
export default function DraftAssistant({
  draft,
  context,
  onApply,
}: {
  draft: string
  context: DraftContext
  onApply: (polished: string) => void
}) {
  const [polishing, setPolishing] = useState(false)
  const [polished, setPolished] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePolish() {
    setError(null)
    setPolished(null)
    setPolishing(true)
    const result = await polishDraftAction(draft, context)
    setPolishing(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setPolished(result.polished)
  }

  function handleApply() {
    if (!polished) return
    onApply(polished)
    setPolished(null)
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handlePolish}
        disabled={polishing || !draft.trim()}
        className="inline-flex items-center gap-1.5 rounded-full border border-accent-light/40 text-accent-light text-xs font-semibold px-3.5 py-1.5 hover:bg-accent-light/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {polishing ? 'Mejorando redacción...' : '✨ Mejorar redacción'}
      </button>

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {polished && (
        <div className="rounded-xl border border-accent-light/30 bg-accent-light/5 p-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-light">Versión sugerida</p>
          <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{polished}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApply}
              className="rounded-full bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-3.5 py-1.5 transition"
            >
              Usar este texto
            </button>
            <button
              type="button"
              onClick={() => setPolished(null)}
              className="rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
