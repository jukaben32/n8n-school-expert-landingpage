'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Percent, Sparkles, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface School {
  id: string
  sibling_discount_min_children: number
  sibling_discount_percent: number
  faq_document: string | null
  tuition_parvulo_amount: number | null
  tuition_inicial_amount: number | null
  tuition_primaria_amount: number | null
  tuition_secundaria_amount: number | null
  tuition_installments_count: number
  tuition_due_day: number
  tuition_grace_days: number
  late_fee_percent: number
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
  const [tuitionParvulo, setTuitionParvulo] = useState(school.tuition_parvulo_amount != null ? String(school.tuition_parvulo_amount) : '')
  const [tuitionInicial, setTuitionInicial] = useState(school.tuition_inicial_amount != null ? String(school.tuition_inicial_amount) : '')
  const [tuitionPrimaria, setTuitionPrimaria] = useState(school.tuition_primaria_amount != null ? String(school.tuition_primaria_amount) : '')
  const [tuitionSecundaria, setTuitionSecundaria] = useState(school.tuition_secundaria_amount != null ? String(school.tuition_secundaria_amount) : '')
  const [installmentsCount, setInstallmentsCount] = useState(String(school.tuition_installments_count))
  const [dueDay, setDueDay] = useState(String(school.tuition_due_day))
  const [graceDays, setGraceDays] = useState(String(school.tuition_grace_days))
  const [lateFeePercent, setLateFeePercent] = useState(String(school.late_fee_percent))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toAmountOrNull = (value: string) => (value.trim() === '' ? null : Math.max(0, Number(value) || 0))

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
        tuition_parvulo_amount: toAmountOrNull(tuitionParvulo),
        tuition_inicial_amount: toAmountOrNull(tuitionInicial),
        tuition_primaria_amount: toAmountOrNull(tuitionPrimaria),
        tuition_secundaria_amount: toAmountOrNull(tuitionSecundaria),
        tuition_installments_count: Math.max(0.5, Number(installmentsCount) || 10.5),
        tuition_due_day: Math.min(28, Math.max(1, Number(dueDay) || 1)),
        tuition_grace_days: Math.max(0, Number(graceDays) || 0),
        late_fee_percent: Math.min(100, Math.max(0, Number(lateFeePercent) || 0)),
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
          <Wallet className="w-4 h-4 text-primary dark:text-accent-light" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Mensualidades y Cuentas por Cobrar</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="tuitionParvulo" className={labelClass}>Párvulos (RD$)</label>
            <input id="tuitionParvulo" type="number" min="0" step="0.01" value={tuitionParvulo} onChange={(e) => setTuitionParvulo(e.target.value)} className={inputClass} placeholder="Sin configurar" />
          </div>
          <div>
            <label htmlFor="tuitionInicial" className={labelClass}>Inicial (RD$)</label>
            <input id="tuitionInicial" type="number" min="0" step="0.01" value={tuitionInicial} onChange={(e) => setTuitionInicial(e.target.value)} className={inputClass} placeholder="Sin configurar" />
          </div>
          <div>
            <label htmlFor="tuitionPrimaria" className={labelClass}>Primaria (RD$)</label>
            <input id="tuitionPrimaria" type="number" min="0" step="0.01" value={tuitionPrimaria} onChange={(e) => setTuitionPrimaria(e.target.value)} className={inputClass} placeholder="Sin configurar" />
          </div>
          <div>
            <label htmlFor="tuitionSecundaria" className={labelClass}>Secundaria (RD$)</label>
            <input id="tuitionSecundaria" type="number" min="0" step="0.01" value={tuitionSecundaria} onChange={(e) => setTuitionSecundaria(e.target.value)} className={inputClass} placeholder="Sin configurar" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="installmentsCount" className={labelClass}>Cuotas del año</label>
            <input id="installmentsCount" type="number" min="0.5" step="0.5" value={installmentsCount} onChange={(e) => setInstallmentsCount(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="dueDay" className={labelClass}>Día de vencimiento</label>
            <input id="dueDay" type="number" min="1" max="28" step="1" value={dueDay} onChange={(e) => setDueDay(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="graceDays" className={labelClass}>Días de gracia</label>
            <input id="graceDays" type="number" min="0" step="1" value={graceDays} onChange={(e) => setGraceDays(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor="lateFeePercent" className={labelClass}>% de recargo por mora</label>
          <input id="lateFeePercent" type="number" min="0" max="100" step="0.5" value={lateFeePercent} onChange={(e) => setLateFeePercent(e.target.value)} className={`${inputClass} max-w-[160px]`} />
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Estos montos alimentan la deuda implícita de <strong>Tesorería → Cuentas por Cobrar</strong>: como no se
          facturan meses futuros (el colegio reporta por lo percibido), el sistema compara cuántas cuotas ya
          debieron vencer contra lo realmente cobrado, por alumno. Un nivel sin monto configurado no aparecerá en
          ese reporte hasta que lo llenes aquí. Con 5 días de gracia, una cuota queda &quot;corriente&quot; hasta
          el día 5 de cada mes; del día 6 en adelante se considera vencida.
        </p>
      </div>

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
