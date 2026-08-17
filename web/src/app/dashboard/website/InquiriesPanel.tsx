'use client'

import { useState, useTransition } from 'react'
import { Mail, Phone, Inbox } from 'lucide-react'
import { updateInquiryStatusAction } from './actions'

export interface InquiryRow {
  id: string
  name: string
  phone: string | null
  email: string | null
  message: string | null
  status: string
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  descartado: 'Descartado',
}
const STATUS_CLASS: Record<string, string> = {
  nuevo: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  contactado: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  descartado: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

export default function InquiriesPanel({ initialInquiries }: { initialInquiries: InquiryRow[] }) {
  const [inquiries, setInquiries] = useState(initialInquiries)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleStatusChange(id: string, status: string) {
    setInquiries((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)))
    setPendingId(id)
    startTransition(async () => {
      await updateInquiryStatusAction(id, status)
      setPendingId(null)
    })
  }

  if (inquiries.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          <Inbox className="w-4 h-4" /> Consultas recibidas
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
          Todavía no ha llegado ninguna consulta desde el formulario de contacto del sitio público.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
        <Inbox className="w-4 h-4" /> Consultas recibidas ({inquiries.length})
      </div>
      <div className="space-y-2">
        {inquiries.map((inquiry) => (
          <div key={inquiry.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3.5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{inquiry.name}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                  {inquiry.phone && (
                    <a href={`tel:${inquiry.phone}`} className="inline-flex items-center gap-1 hover:underline">
                      <Phone className="w-3 h-3" /> {inquiry.phone}
                    </a>
                  )}
                  {inquiry.email && (
                    <a href={`mailto:${inquiry.email}`} className="inline-flex items-center gap-1 hover:underline">
                      <Mail className="w-3 h-3" /> {inquiry.email}
                    </a>
                  )}
                  <span>{new Date(inquiry.created_at).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
              <select
                value={inquiry.status}
                disabled={pendingId === inquiry.id}
                onChange={(e) => handleStatusChange(inquiry.id, e.target.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold border-0 outline-none ${STATUS_CLASS[inquiry.status] ?? STATUS_CLASS.nuevo}`}
              >
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            {inquiry.message && <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{inquiry.message}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
