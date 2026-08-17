'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Percent, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface School {
  id: string
  sibling_discount_min_children: number
  sibling_discount_percent: number
  faq_document: string | null
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'
const sectionClass = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4'

export default function OperationsForm({ school }: { school: School }) {
  const router = useRouter()
  const [siblingMinChildren, setSiblingMinChildren] = useState(String(school.sibling_discount_min_children))
  const [siblingPercent, setSiblingPercent] = useState(String(school.sibling_discount_percent))
  const [faqDocument, setFaqDocument] = useState(school.faq_document ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)
    const supabase = createClient()
    const { error: dbError } = await supabase
      .from('schools')
      .update({
        sibling_discount_min_children: Math.max(1, Number(siblingMinChildren) || 3),
        sibling_discount_percent: Math.min(100, Math.max(0, Number(siblingPercent) || 0)),
        faq_document: faqDocument.trim() || null,
      })
      .eq('id', school.id)

    setSaving(false)
    if (dbError) {
      setError('No se pudo guardar. Intenta de nuevo.')
      return
    }
    setSaved(true)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className={sectionClass}>
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4 text-primary dark:text-accent-light" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Descuento por hermanos (Tesorería)</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="siblingMinChildren" className={labelClass}>A partir de qué hijo</label>
            <input
              id="siblingMinChildren"
              type="number"
              min="1"
              step="1"
              value={siblingMinChildren}
              onChange={(e) => setSiblingMinChildren(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="siblingPercent" className={labelClass}>% de descuento</label>
            <input
              id="siblingPercent"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={siblingPercent}
              onChange={(e) => setSiblingPercent(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Ej. con 3 y 10%: una familia con 3+ hijos inscritos paga completo por el 1ro y 2do, y el 3ro en
          adelante (ordenados por fecha de nacimiento) recibe 10% de descuento en su factura. Se aplica
          automáticamente al generar la factura en Tesorería.
        </p>
      </div>

      <div className={sectionClass}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary dark:text-accent-light" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Asistente de IA</p>
        </div>
        <div>
          <label htmlFor="faqDocument" className={labelClass}>
            Preguntas frecuentes del colegio
          </label>
          <textarea
            id="faqDocument"
            rows={8}
            value={faqDocument}
            onChange={(e) => setFaqDocument(e.target.value)}
            placeholder={'Ej.\n¿Cuál es el horario de entrada y salida?\nInicial: 7:25 a.m. - 11:50 a.m. ...\n\n¿Qué incluye el uniforme?\n...'}
            className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
            Todo lo que escribas aquí (horarios, uniforme, cafetería, reglas generales) el Asistente de IA del
            Portal Familiar lo usa junto con los datos reales de cada familia para responder — útil para las
            preguntas que no dependen de datos de un estudiante en particular. Documentos muy largos aumentan
            un poco el costo de cada respuesta del asistente.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      {saved && (
        <div role="status" className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          ✓ Guardado.
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-2.5 text-sm transition shadow-glow disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
