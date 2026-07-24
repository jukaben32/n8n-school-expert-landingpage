'use client'

import { useEffect } from 'react'

/**
 * Error boundary global — cubre errores no controlados fuera de
 * /dashboard/* (login, landing, recuperar contraseña).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app error]', error)
  }, [error])

  return (
    <html lang="es">
      <body>
        <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-white to-accent/10 dark:from-slate-950 dark:via-slate-900 dark:to-primary-dark/20 px-4">
          <div className="max-w-md text-center space-y-4">
            <p className="text-4xl" aria-hidden="true">⚠️</p>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Algo salió mal
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ocurrió un error inesperado. Intenta de nuevo en unos segundos.
            </p>
            <button
              onClick={reset}
              className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-6 py-2.5 transition shadow-glow"
            >
              Intentar de nuevo
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
