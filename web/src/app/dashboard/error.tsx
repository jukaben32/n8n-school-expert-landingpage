'use client'

import { useEffect } from 'react'

/**
 * Error boundary — captura errores no controlados en cualquier página
 * bajo /dashboard/* (ej. una consulta a Supabase que falla) y muestra
 * una pantalla útil en vez del overlay genérico de Next.js.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard error]', error)
  }, [error])

  return (
    <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
      <p className="text-4xl" aria-hidden="true">⚠️</p>
      <h1 className="text-xl font-black text-slate-900 dark:text-white">
        Algo salió mal
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Ocurrió un error inesperado al cargar esta página. Puedes intentar de nuevo o volver al panel.
      </p>
      <div className="flex justify-center gap-3 pt-2">
        <button
          onClick={reset}
          className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 transition shadow-glow"
        >
          Intentar de nuevo
        </button>
        <a
          href="/dashboard/secretaria"
          className="rounded-full border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          Volver al panel
        </a>
      </div>
    </div>
  )
}
