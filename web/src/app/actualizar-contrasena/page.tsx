'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Actualizar contraseña — pantalla común para dos flujos de Supabase Auth:
 * 1) Invitación (alguien recibe acceso por primera vez, admin.inviteUserByEmail)
 * 2) Recuperación (alguien olvidó su contraseña, resetPasswordForEmail)
 * En ambos casos, el enlace del correo trae un parámetro `?code=...` (flujo
 * PKCE) que hay que intercambiar explícitamente por una sesión real -- no
 * basta con asumir que Supabase ya la creó sola al cargar la página.
 */
export default function ActualizarContrasenaFallback() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-white to-accent/10 dark:from-slate-950 dark:via-slate-900 dark:to-primary-dark/20">
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando...</p>
      </main>
    }>
      <ActualizarContrasenaPage />
    </Suspense>
  )
}

function ActualizarContrasenaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const code = searchParams.get('code')

    async function resolveSession() {
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          console.error('[actualizar-contrasena] exchangeCodeForSession', exchangeError)
        }
      }
      const { data: { session } } = await supabase.auth.getSession()
      setHasSession(!!session)
      setCheckingSession(false)
    }

    resolveSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setStatus('saving')
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError('No se pudo actualizar la contraseña. Intenta de nuevo.')
      setStatus('error')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-white to-accent/10 dark:from-slate-950 dark:via-slate-900 dark:to-primary-dark/20">
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando...</p>
      </main>
    )
  }

  if (!hasSession) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary/10 via-white to-accent/10 dark:from-slate-950 dark:via-slate-900 dark:to-primary-dark/20">
        <div className="max-w-md text-center space-y-3">
          <p className="text-4xl" aria-hidden="true">🔗</p>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Enlace vencido o inválido</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Este enlace ya expiró o ya fue usado. Pide uno nuevo desde{' '}
            <a href="/recuperar-contrasena" className="text-primary dark:text-accent-light font-semibold hover:underline">
              recuperar contraseña
            </a>.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-primary/10 via-white to-accent/10 dark:from-slate-950 dark:via-slate-900 dark:to-primary-dark/20">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight text-center">
          Elige tu contraseña
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center">
          Con esto queda activa tu cuenta en MentorIApp.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-white/70 dark:border-slate-800 rounded-3xl shadow-soft p-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Contraseña nueva
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Confírmala
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'saving'}
            className="w-full rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition shadow-glow disabled:opacity-60"
          >
            {status === 'saving' ? 'Guardando...' : 'Guardar y entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
