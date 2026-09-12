'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PasswordInput from '@/components/PasswordInput'
import { createClient } from '@/lib/supabase/client'

/**
 * Actualizar contraseña — pantalla común para dos orígenes de enlace, que
 * NO comparten el mismo formato de URL:
 *
 * 1) Autoservicio (`/recuperar-contrasena`, la propia persona pide su
 *    enlace desde su navegador) -- usa flujo PKCE, trae `?code=...` y se
 *    intercambia con `exchangeCodeForSession`.
 * 2) Disparado desde el panel por un admin ("reenviar acceso" en
 *    Personal/Familias, o la invitación inicial) -- corre en el SERVIDOR
 *    (`createAdminClient()`), y Supabase no soporta PKCE ahí (ver el
 *    aviso de la propia librería en `GoTrueAdminApi.inviteUserByEmail`:
 *    "PKCE is not supported... the browser initiating the invite is
 *    often different from the browser accepting it"). Ese enlace llega
 *    en cambio como fragmento `#access_token=...&refresh_token=...`
 *    (flujo implícito) -- si no se maneja aparte, la librería lo
 *    descarta en su auto-detección interna (choca con el `flowType:
 *    'pkce'` fijo del cliente) y la página nunca ve una sesión, sin
 *    importar cuánto tiempo haya pasado desde que se envió el correo.
 *    Bug real reportado por un usuario: esto se confundió con un
 *    problema de "el enlace expira muy rápido" (ver AGENTS.md).
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
  const [resetEmail, setResetEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const code = searchParams.get('code')

    async function resolveSession() {
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          console.error('[actualizar-contrasena] exchangeCodeForSession', exchangeError)
        }
      } else if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
        // Enlace disparado desde el panel (inviteUserByEmail / resetPasswordForEmail
        // del admin client) -- no es PKCE, así que no trae `?code=`. Supabase lo
        // manda como fragmento de URL en su lugar; se lee a mano porque el
        // cliente (configurado en flowType 'pkce') no lo procesa solo.
        const hashParams = new URLSearchParams(window.location.hash.slice(1))
        const access_token = hashParams.get('access_token')
        const refresh_token = hashParams.get('refresh_token')
        if (access_token && refresh_token) {
          const { error: setSessionError } = await supabase.auth.setSession({ access_token, refresh_token })
          if (setSessionError) {
            console.error('[actualizar-contrasena] setSession (enlace de admin)', setSessionError)
          }
          window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
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
      setError('No se pudo actualizar la contraseña. Si el enlace venció, solicita uno nuevo abajo.')
      setStatus('error')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleRequestNewLink(e: React.FormEvent) {
    e.preventDefault()
    setResetStatus('sending')
    setResetMessage(null)
    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/actualizar-contrasena` : undefined,
      })
      if (resetError) throw resetError
      setResetStatus('sent')
      setResetMessage('Si ese correo tiene acceso, enviamos un enlace nuevo para crear la contraseña.')
    } catch (resetError) {
      console.error('[actualizar-contrasena] resetPasswordForEmail', resetError)
      setResetStatus('error')
      setResetMessage('No pudimos enviar el enlace. Verifica el correo o pide ayuda al colegio.')
    }
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
      <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-primary/10 via-white to-accent/10 dark:from-slate-950 dark:via-slate-900 dark:to-primary-dark/20">
        <div className="w-full max-w-md text-center">
          <p className="text-4xl" aria-hidden="true">🔗</p>
          <h1 className="mt-3 text-xl font-black text-slate-900 dark:text-white">Enlace vencido o inválido</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Escribe tu correo y te enviaremos un enlace nuevo para crear tu contraseña.
          </p>

          <form onSubmit={handleRequestNewLink} className="mt-5 space-y-3 rounded-3xl border border-white/70 bg-white/90 p-5 text-left shadow-soft backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
            <div>
              <label htmlFor="resetEmail" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Correo electrónico
              </label>
              <input
                id="resetEmail"
                type="email"
                required
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            {resetMessage && (
              <div
                role="status"
                className={`rounded-xl border px-4 py-3 text-sm ${
                  resetStatus === 'sent'
                    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                }`}
              >
                {resetMessage}
              </div>
            )}
            <button
              type="submit"
              disabled={resetStatus === 'sending'}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-primary-dark disabled:opacity-60"
            >
              {resetStatus === 'sending' ? 'Enviando...' : 'Enviar enlace nuevo'}
            </button>
          </form>
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
            <PasswordInput
              id="password"
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
            <PasswordInput
              id="confirmPassword"
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
