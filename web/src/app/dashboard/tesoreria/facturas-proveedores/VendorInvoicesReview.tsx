'use client'

import { useState } from 'react'
import {
  approveVendorInvoice,
  getVendorInvoiceSignedUrl,
  listPendingVendorInvoices,
  rejectVendorInvoice,
  uploadVendorInvoices,
  type PendingVendorInvoice,
} from './actions'

const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1'

interface DraftInvoice {
  proveedor: string
  rnc: string
  ncf: string
  fecha: string
  subtotal: string
  itbis: string
  total: string
  categoria: string
}

function draftFromInvoice(invoice: PendingVendorInvoice): DraftInvoice {
  const d = invoice.extracted_data
  return {
    proveedor: d?.proveedor ?? '',
    rnc: d?.rnc ?? '',
    ncf: d?.ncf ?? '',
    fecha: d?.fecha ?? '',
    subtotal: d?.subtotal != null ? String(d.subtotal) : '',
    itbis: d?.itbis != null ? String(d.itbis) : '',
    total: d?.total != null ? String(d.total) : '',
    categoria: d?.categoria_sugerida ?? '',
  }
}

export default function VendorInvoicesReview({ initialInvoices }: { initialInvoices: PendingVendorInvoice[] }) {
  const [invoices, setInvoices] = useState(initialInvoices)
  const [uploadMode, setUploadMode] = useState<'files' | 'multiPagePdf'>('files')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DraftInvoice>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<{ id: string; url: string } | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  async function refresh() {
    setInvoices(await listPendingVendorInvoices())
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploadError(null)
    setUploadNotice(null)
    const form = e.currentTarget
    const files = (form.elements.namedItem('file') as HTMLInputElement)?.files
    if (!files || files.length === 0) {
      setUploadError('Selecciona al menos un archivo.')
      return
    }

    const formData = new FormData()
    formData.set('mode', uploadMode)
    for (const file of Array.from(files)) formData.append('file', file)

    setUploading(true)
    const result = await uploadVendorInvoices(formData)
    setUploading(false)

    if (!result.ok) {
      setUploadError(result.error)
      return
    }
    setUploadNotice(`Se procesaron ${result.created} factura(s). Revísalas abajo antes de aprobar.`)
    form.reset()
    await refresh()
  }

  function toggleOpen(invoice: PendingVendorInvoice) {
    if (openId === invoice.id) {
      setOpenId(null)
      return
    }
    setOpenId(invoice.id)
    setDrafts((prev) => (prev[invoice.id] ? prev : { ...prev, [invoice.id]: draftFromInvoice(invoice) }))
  }

  function updateDraft(id: string, patch: Partial<DraftInvoice>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function handlePreview(id: string) {
    const url = await getVendorInvoiceSignedUrl(id)
    if (!url) return
    setPreviewUrl({ id, url })
  }

  async function handleApprove(invoice: PendingVendorInvoice) {
    const draft = drafts[invoice.id]
    if (!draft) return
    setFormError(null)

    const subtotal = Number(draft.subtotal)
    const itbis = Number(draft.itbis)
    const total = Number(draft.total)
    if (!draft.proveedor || Number.isNaN(subtotal) || Number.isNaN(itbis) || Number.isNaN(total)) {
      setFormError('Completa al menos proveedor, subtotal, ITBIS y total con valores numéricos válidos.')
      return
    }

    setBusyId(invoice.id)
    const result = await approveVendorInvoice(invoice.id, {
      proveedor: draft.proveedor,
      rnc: draft.rnc || null,
      ncf: draft.ncf || null,
      fecha: draft.fecha || null,
      subtotal,
      itbis,
      total,
      categoria: draft.categoria || null,
    })
    setBusyId(null)
    if (!result.ok) {
      setFormError(result.error ?? 'No se pudo aprobar la factura.')
      return
    }
    setInvoices((prev) => prev.filter((i) => i.id !== invoice.id))
    setOpenId(null)
  }

  async function handleReject(id: string) {
    setBusyId(id)
    const result = await rejectVendorInvoice(id, rejectReason)
    setBusyId(null)
    if (!result.ok) {
      setFormError(result.error ?? 'No se pudo rechazar la factura.')
      return
    }
    setInvoices((prev) => prev.filter((i) => i.id !== id))
    setRejectingId(null)
    setRejectReason('')
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleUpload} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => setUploadMode('files')}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${uploadMode === 'files' ? 'bg-primary text-white shadow-glow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
            Varias facturas sueltas
          </button>
          <button type="button" onClick={() => setUploadMode('multiPagePdf')}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${uploadMode === 'multiPagePdf' ? 'bg-primary text-white shadow-glow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
            Un PDF con varias facturas
          </button>
        </div>

        <div>
          <label htmlFor="file" className={labelClass}>
            {uploadMode === 'files' ? 'Selecciona una o varias facturas (imagen o PDF por factura)' : 'Selecciona el PDF escaneado (una factura por página)'}
          </label>
          <input
            id="file"
            name="file"
            type="file"
            multiple={uploadMode === 'files'}
            accept={uploadMode === 'files' ? 'image/jpeg,image/png,image/webp,application/pdf' : 'application/pdf'}
            className={inputClass}
          />
        </div>

        {uploadError && (
          <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {uploadError}
          </div>
        )}
        {uploadNotice && (
          <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            {uploadNotice}
          </div>
        )}

        <button type="submit" disabled={uploading}
          className="w-full rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 text-sm transition shadow-glow disabled:opacity-60">
          {uploading ? 'Procesando con IA...' : 'Subir y extraer datos'}
        </button>
      </form>

      {formError && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {formError}
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">🧾</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">No hay facturas pendientes de revisión.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const draft = drafts[invoice.id]
            const isOpen = openId === invoice.id
            const confidencePct = invoice.confidence != null ? Math.round(invoice.confidence * 100) : null
            return (
              <article key={invoice.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {invoice.extracted_data?.proveedor ?? '(proveedor no legible)'}
                      {invoice.source_page ? ` — página ${invoice.source_page}` : ''}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {invoice.extracted_data?.ncf ?? 'sin NCF'} · {invoice.extracted_data?.total != null ? `RD$${invoice.extracted_data.total.toLocaleString('es-DO')}` : ''}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{new Date(invoice.created_at).toLocaleString('es-DO')}</p>
                    {invoice.extraction_error && (
                      <p className="text-xs text-red-500 mt-1">No se pudo leer automáticamente: {invoice.extraction_error}</p>
                    )}
                  </div>
                  {confidencePct != null && (
                    <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${confidencePct >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                      {confidencePct}% de confianza
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => handlePreview(invoice.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                    Ver factura original
                  </button>
                  <button type="button" onClick={() => toggleOpen(invoice)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary dark:bg-accent/10 dark:text-accent-light hover:bg-primary/20 transition">
                    {isOpen ? 'Ocultar' : 'Revisar y aprobar'}
                  </button>
                  <button type="button" onClick={() => setRejectingId(rejectingId === invoice.id ? null : invoice.id)} disabled={busyId === invoice.id}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-60">
                    Rechazar
                  </button>
                </div>

                {previewUrl?.id === invoice.id && (
                  <a href={previewUrl.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary dark:text-accent-light underline">
                    Abrir factura original en una pestaña nueva (enlace válido por 5 minutos)
                  </a>
                )}

                {rejectingId === invoice.id && (
                  <div className="flex gap-2">
                    <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motivo (opcional)" className={inputClass} />
                    <button type="button" onClick={() => handleReject(invoice.id)} disabled={busyId === invoice.id}
                      className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-60">
                      Confirmar
                    </button>
                  </div>
                )}

                {isOpen && draft && (
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2"><label className={labelClass}>Proveedor</label><input className={inputClass} value={draft.proveedor} onChange={(e) => updateDraft(invoice.id, { proveedor: e.target.value })} /></div>
                      <div><label className={labelClass}>RNC</label><input className={inputClass} value={draft.rnc} onChange={(e) => updateDraft(invoice.id, { rnc: e.target.value })} /></div>
                      <div><label className={labelClass}>NCF</label><input className={inputClass} value={draft.ncf} onChange={(e) => updateDraft(invoice.id, { ncf: e.target.value })} /></div>
                      <div><label className={labelClass}>Fecha</label><input type="date" className={inputClass} value={draft.fecha} onChange={(e) => updateDraft(invoice.id, { fecha: e.target.value })} /></div>
                      <div><label className={labelClass}>Categoría</label><input className={inputClass} value={draft.categoria} onChange={(e) => updateDraft(invoice.id, { categoria: e.target.value })} /></div>
                      <div><label className={labelClass}>Subtotal (DOP)</label><input type="number" step="0.01" className={inputClass} value={draft.subtotal} onChange={(e) => updateDraft(invoice.id, { subtotal: e.target.value })} /></div>
                      <div><label className={labelClass}>ITBIS (DOP)</label><input type="number" step="0.01" className={inputClass} value={draft.itbis} onChange={(e) => updateDraft(invoice.id, { itbis: e.target.value })} /></div>
                      <div className="col-span-2"><label className={labelClass}>Total (DOP)</label><input type="number" step="0.01" className={inputClass} value={draft.total} onChange={(e) => updateDraft(invoice.id, { total: e.target.value })} /></div>
                    </div>

                    <button type="button" onClick={() => handleApprove(invoice)} disabled={busyId === invoice.id}
                      id={`btn-aprobar-factura-${invoice.id}`}
                      className="w-full rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 text-sm transition shadow-glow disabled:opacity-60">
                      {busyId === invoice.id ? 'Aprobando...' : 'Aprobar factura'}
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
