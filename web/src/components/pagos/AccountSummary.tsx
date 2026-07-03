'use client'

interface AccountSummaryProps {
  totalPendiente: number
  totalVencido: number
  totalPagado: number
}

/**
 * AccountSummary — Tarjetas de resumen del estado de cuenta
 */
export default function AccountSummary({ totalPendiente, totalVencido, totalPagado }: AccountSummaryProps) {
  // Formateador de moneda (DOP)
  const formatDOP = (amount: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
    }).format(amount)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Pendiente Total (Incluye vencido) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total a pagar</p>
        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
          {formatDOP(totalPendiente + totalVencido)}
        </p>
      </div>

      {/* Monto Vencido (Alerta) */}
      <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 p-5 relative overflow-hidden">
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">En atraso</p>
        <p className="text-2xl font-black text-red-700 dark:text-red-300 mt-1">
          {formatDOP(totalVencido)}
        </p>
        {totalVencido > 0 && (
          <div className="absolute top-0 right-0 w-12 h-12 bg-red-100 dark:bg-red-500/20 rounded-bl-[100%] flex items-start justify-end p-2">
            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

      {/* Historial pagado */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-5">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total pagado</p>
        <p className="text-2xl font-black text-slate-600 dark:text-slate-300 mt-1">
          {formatDOP(totalPagado)}
        </p>
      </div>
    </div>
  )
}
