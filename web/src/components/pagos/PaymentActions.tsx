'use client'

import { useRef, useState } from 'react'
import { startAzulPayment, uploadPaymentReceipt } from '@/app/dashboard/pagos/actions'

interface PaymentActionsProps {
  invoiceId: string
  pendingReceiptStatus?: 'pendiente' | 'confirmado' | 'rechazado' | null
}

/**
 * Botones de pago de una factura pendiente: "Pagar con tarjeta" (Azul,
 * Parte A) y "Ya transferí" (comprobante bancario, Parte B).
 */
export default function PaymentActions({ invoiceId, pendingReceiptStatus }: PaymentActionsProps) {
  const [payingWithCard, setPayingWithCard] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handlePayWithCard() {
    setError(null)
    setPayingWithCard(true)
    const result = await startAzulPayment(invoiceId)
    if (!result.ok) {
      setError(result.error)
      setPayingWithCard(false)
      return
    }

    // Azul exige que el POST lo haga el navegador del cliente directamente
    // a su dominio -- se arma un formulario temporal y se envía.
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = result.form.actionUrl
    for (const [name, value] of Object.entries(result.form.fields)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
  }

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const file = fileInputRef.current?.files?.[0]
    if (!amount || Number(amount) <= 0) {
      setError('Indica el monto que transferiste.')
      return
    }
    if (!file) {
      setError('Adjunta una foto o PDF del comprobante.')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.set('invoiceId', invoiceId)
    formData.set('amount', amount)
    formData.set('file', file)

    const result = await uploadPaymentReceipt(formData)
    setUploading(false)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo subir el comprobante.')
      return
    }
    setUploaded(true)
    setShowUpload(false)
  }

  if (uploaded || pendingReceiptStatus === 'pendiente') {
    return (
      <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        Comprobante en revisión
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePayWithCard}
          disabled={payingWithCard}
          className="text-xs font-semibold px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-full transition shadow-glow disabled:opacity-60"
        >
          {payingWithCard ? 'Redirigiendo…' : 'Pagar con tarjeta'}
        </button>
        <button
          type="button"
          onClick={() => setShowUpload((v) => !v)}
          className="text-xs font-semibold px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          Ya transferí
        </button>
      </div>

      {pendingReceiptStatus === 'rechazado' && (
        <p className="text-xs text-red-600 dark:text-red-400">Tu comprobante anterior fue rechazado. Puedes subir uno nuevo.</p>
      )}

      {showUpload && (
        <form ref={formRef} onSubmit={handleUploadSubmit} className="w-full max-w-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Monto transferido (DOP)</label>
            <input
              type="number" min="0" step="0.01" required value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Comprobante (foto o PDF)</label>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required className="w-full text-xs text-slate-600 dark:text-slate-300" />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="w-full text-xs font-semibold px-3 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition disabled:opacity-60"
          >
            {uploading ? 'Subiendo…' : 'Enviar comprobante'}
          </button>
        </form>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400 max-w-xs text-right">{error}</p>}
    </div>
  )
}
