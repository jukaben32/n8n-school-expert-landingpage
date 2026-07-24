'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface PendingInvoice {
  id: string; description: string; total_amount: number; due_date: string; status: string
  families: { name: string } | null
}

interface NewPaymentFormProps {
  schoolId: string
  receivedBy: string
  invoices: PendingInvoice[]
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

export default function NewPaymentForm({ schoolId, receivedBy, invoices }: NewPaymentFormProps) {
  const router = useRouter()
  const [invoiceId, setInvoiceId] = useState(invoices[0]?.id ?? '')
  const [amountPaid, setAmountPaid] = useState(invoices[0] ? String(invoices[0].total_amount) : '')
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedInvoice = invoices.find((i) => i.id === invoiceId)
  const formatDOP = useMemo(() => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }), [])

  function selectInvoice(id: string) {
    setInvoiceId(id)
    const inv = invoices.find((i) => i.id === id)
    setAmountPaid(inv ? String(inv.total_amount) : '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!invoiceId || !amountPaid || Number(amountPaid) <= 0) {
      setError('Selecciona la factura e indica el monto pagado.')
      return
    }
    setSaving(true)
    const supabase = createClient()

    try {
      const { error: paymentError } = await supabase.from('payments').insert({
        school_id: schoolId,
        invoice_id: invoiceId,
        amount_paid: Number(amountPaid),
        payment_method: paymentMethod,
        received_by: receivedBy,
        notes: notes.trim() || null,
      })
      if (paymentError) throw paymentError

      // Si el pago cubre el total de la factura, se marca como pagada.
      if (selectedInvoice && Number(amountPaid) >= selectedInvoice.total_amount) {
        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({ status: 'pagado', paid_at: new Date().toISOString() })
          .eq('id', invoiceId)
        if (invoiceError) throw invoiceError
      }

      router.push('/dashboard/tesoreria')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo registrar el pago. Intenta de nuevo.'
      setError(message)
      setSaving(false)
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
        <p className="text-4xl mb-3" aria-hidden="true">🎉</p>
        <p className="text-slate-500 dark:text-slate-400 text-sm">No hay facturas pendientes de cobro.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div>
          <label htmlFor="invoice" className={labelClass}>Factura</label>
          <select id="invoice" value={invoiceId} onChange={(e) => selectInvoice(e.target.value)} className={inputClass}>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.families?.name ?? 'Familia'} — {inv.description} ({formatDOP.format(inv.total_amount)})
              </option>
            ))}
          </select>
        </div>

        {selectedInvoice && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 text-sm space-y-1">
            <p className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Vence</span><span className="text-slate-700 dark:text-slate-200">{new Date(selectedInvoice.due_date).toLocaleDateString('es-DO')}</span></p>
            <p className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Total factura</span><span className="font-semibold text-slate-900 dark:text-white">{formatDOP.format(selectedInvoice.total_amount)}</span></p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="amountPaid" className={labelClass}>Monto recibido (DOP)</label>
            <input id="amountPaid" type="number" min="0" step="0.01" required value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="method" className={labelClass}>Método</label>
            <select id="method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="azul">Azul</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="notes" className={labelClass}>Notas (opcional)</label>
          <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition shadow-glow disabled:opacity-60"
        >
          {saving ? 'Registrando...' : 'Registrar pago'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-slate-200 dark:border-slate-700 px-6 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
