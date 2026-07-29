'use client'

import { useMemo, useState } from 'react'
import { confirmReceipt, getReceiptSignedUrl, rejectReceipt, type PendingReceipt } from '../actions'

export default function ReceiptsReview({ initialReceipts }: { initialReceipts: PendingReceipt[] }) {
  const [receipts, setReceipts] = useState(initialReceipts)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<{ id: string; url: string } | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const formatDOP = useMemo(() => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }), [])

  async function handlePreview(receiptId: string) {
    setError(null)
    const url = await getReceiptSignedUrl(receiptId)
    if (!url) {
      setError('No se pudo generar el enlace del comprobante.')
      return
    }
    setPreviewUrl({ id: receiptId, url })
  }

  async function handleConfirm(receiptId: string) {
    setError(null)
    setBusyId(receiptId)
    const result = await confirmReceipt(receiptId)
    setBusyId(null)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo confirmar el comprobante.')
      return
    }
    setReceipts((prev) => prev.filter((r) => r.id !== receiptId))
  }

  async function handleReject(receiptId: string) {
    setError(null)
    setBusyId(receiptId)
    const result = await rejectReceipt(receiptId, rejectReason)
    setBusyId(null)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo rechazar el comprobante.')
      return
    }
    setReceipts((prev) => prev.filter((r) => r.id !== receiptId))
    setRejectingId(null)
    setRejectReason('')
  }

  if (receipts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
        <p className="text-4xl mb-3" aria-hidden="true">📭</p>
        <p className="text-slate-500 dark:text-slate-400 text-sm">No hay comprobantes pendientes de revisión.</p>
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

      {receipts.map((receipt) => (
        <article key={receipt.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {receipt.families?.name ?? 'Familia'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {receipt.invoices?.description ?? 'Factura'} — factura {receipt.invoices ? formatDOP.format(receipt.invoices.total_amount) : ''}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {new Date(receipt.created_at).toLocaleString('es-DO')}
              </p>
            </div>
            <p className="text-base font-black text-slate-900 dark:text-white shrink-0">
              {formatDOP.format(receipt.amount)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handlePreview(receipt.id)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Ver comprobante
            </button>
            <button
              type="button"
              onClick={() => handleConfirm(receipt.id)}
              disabled={busyId === receipt.id}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-green-600 hover:bg-green-700 text-white transition disabled:opacity-60"
            >
              Confirmar pago
            </button>
            <button
              type="button"
              onClick={() => setRejectingId(rejectingId === receipt.id ? null : receipt.id)}
              disabled={busyId === receipt.id}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-60"
            >
              Rechazar
            </button>
          </div>

          {previewUrl?.id === receipt.id && (
            <a href={previewUrl.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary dark:text-accent-light underline">
              Abrir comprobante en una pestaña nueva (enlace válido por 5 minutos)
            </a>
          )}

          {rejectingId === receipt.id && (
            <div className="flex gap-2">
              <input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Motivo del rechazo (opcional)"
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => handleReject(receipt.id)}
                disabled={busyId === receipt.id}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-60"
              >
                Confirmar rechazo
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}
