'use client'

import PaymentActions from './PaymentActions'

type InvoiceStatus = 'pendiente' | 'pagado' | 'vencido' | 'anulado'
type ReceiptStatus = 'pendiente' | 'confirmado' | 'rechazado'

interface InvoiceCardProps {
  invoice: {
    id: string
    description: string
    total_amount: number
    due_date: string
    status: InvoiceStatus
    ncf: string | null
    paid_at: string | null
    students: { first_name: string; last_name: string } | null
  }
  receiptStatus?: ReceiptStatus | null
}

const statusStyles = {
  pendiente: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  vencido:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  pagado:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  anulado:   'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
}

/**
 * InvoiceCard — Tarjeta individual para mostrar el detalle de una factura.
 */
export default function InvoiceCard({ invoice, receiptStatus }: InvoiceCardProps) {
  const { description, total_amount, due_date, status, ncf, paid_at, students } = invoice

  const formatDOP = (amount: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-DO', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  return (
    <article className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition hover:shadow-sm">
      
      {/* Información principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusStyles[status]}`}>
            {status}
          </span>
          {ncf && (
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              {ncf}
            </span>
          )}
        </div>
        
        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
          {description}
        </h3>
        
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
          {students && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {students.first_name} {students.last_name}
            </span>
          )}
          
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {status === 'pagado' && paid_at ? `Pagado el ${formatDate(paid_at)}` : `Vence el ${formatDate(due_date)}`}
          </span>
        </div>
      </div>

      {/* Monto y Botón */}
      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0">
        <p className="text-lg font-black text-slate-900 dark:text-white">
          {formatDOP(total_amount)}
        </p>
        
        {status !== 'pagado' && status !== 'anulado' && (
          <PaymentActions invoiceId={invoice.id} pendingReceiptStatus={receiptStatus} />
        )}
      </div>

    </article>
  )
}
