'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { normalizeLoginIdentifier } from '@/lib/auth/studentAccess'
import PasswordInput from '@/components/PasswordInput'

/**
 * Formulario de Login — Client Component
 * Maneja el estado del formulario y la llamada a Supabase Auth.
 */
export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    // El personal y los tutores escriben su correo; los estudiantes solo
    // su código de acceso (no tienen correo), y aquí se le agrega el
    // dominio interno para convertirlo en la identidad de Auth.
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: normalizeLoginIdentifier(email),
      password,
    })

    if (authError) {
      // Mensaje amigable en español
      if (authError.message.includes('Invalid login')) {
        setError('Correo/código o contraseña incorrectos. Intenta de nuevo.')
      } else {
        setError('Ocurrió un error. Por favor intenta más tarde.')
      }
      if (process.env.NODE_ENV === 'development') {
        // Log de diagnóstico en desarrollo para ver el error exacto de Supabase
        // (No se muestra al usuario final)
        console.error('Supabase signIn error:', authError)
      }
      setLoading(false)
      return
    }

    // El middleware manda aquí con ?redirect=/lo-que-sea cuando una sesión
    // vencida interrumpió la visita a una página protegida (ej. Configuración).
    // Antes esto se ignoraba por completo y SIEMPRE mandaba a /dashboard, que
    // para super_admin redirige a Plataforma -- así que un simple "se venció
    // la sesión mientras estaba en Configuración" se sentía como "Configuración
    // no funciona", sin relación real con la página que se quería ver.
    // Se valida que empiece con "/" y no con "//" para no reenviar a un
    // dominio externo si alguien arma el parámetro a mano (open redirect).
    const redirectTo = searchParams.get('redirect')
    const isSafeRedirect = !!redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
    router.push(isSafeRedirect ? redirectTo : '/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Campo email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Correo electrónico o código de estudiante
        </label>
        <input
          id="email"
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com  ó  K7MPQ34"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Campo contraseña */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Contraseña
          </label>
          <a href="/recuperar-contrasena" className="text-xs text-primary dark:text-accent-light hover:underline">
            ¿La olvidaste?
          </a>
        </div>
        <PasswordInput
          id="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Botón submit */}
      <button
        id="login-submit-btn"
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 text-sm transition shadow-glow disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Verificando...
          </>
        ) : (
          'Iniciar sesión'
        )}
      </button>

      {/* Aviso informativo (por ejemplo, enlace mágico enviado) */}
      {notice && (
        <div role="status" className="mt-3 flex items-start gap-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-11.25a.75.75 0 011.5 0v4.5a.75.75 0 01-1.5 0v-4.5zM10 15a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {notice}
        </div>
      )}

      {/* Alternativa: acceso por enlace mágico */}
      <div className="mt-3 text-center">
        <button
          type="button"
          disabled={loading || !email}
          onClick={async () => {
            try {
              setError(null)
              setNotice(null)
              const supabase = createClient()
              if (!email.includes('@')) {
                setError('El enlace mágico solo funciona con un correo. Si eres estudiante, entra con tu código y contraseña.')
                return
              }
              const { error: otpError } = await supabase.auth.signInWithOtp({
                email,
                options: {
                  // shouldCreateUser: false -- este correo debe tener ya una
                  // cuenta creada por invitación del colegio (personal o
                  // tutor). Sin esto, cualquiera podía escribir un correo no
                  // invitado aquí y Supabase le creaba una cuenta nueva y
                  // vacía en el momento -- sin perfil, sin rol, cayendo por
                  // defecto en el portal de padres (ver dashboard/layout.tsx).
                  // Así fue como 2 profesores del colegio terminaron ahí sin
                  // haber sido invitados todavía.
                  shouldCreateUser: false,
                  emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
                },
              })
              if (otpError) throw otpError
              setNotice('Te enviamos un enlace mágico a tu correo. Revísalo para acceder sin contraseña.')
            } catch (e) {
              const message = e instanceof Error ? e.message.toLowerCase() : ''
              if (message.includes('signups not allowed') || message.includes('user not found')) {
                setError('Ese correo todavía no tiene una cuenta. Pide a tu colegio que te invite primero.')
              } else {
                setError('No pudimos enviar el enlace mágico. Verifica el correo o inténtalo más tarde.')
              }
            }
          }}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary dark:hover:border-accent-light dark:hover:text-accent-light disabled:opacity-60"
        >
          Enviarme enlace mágico
        </button>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Te enviaremos un enlace de acceso al correo indicado.</p>
      </div>
    </form>
  )
}
