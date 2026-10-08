'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { normalizeLoginIdentifier } from '@/lib/auth/studentAccess'
import PasswordInput from '@/components/PasswordInput'

/**
 * Traduce el error de Supabase Auth a un mensaje en español que ayude a
 * saber qué pasó realmente -- antes, cualquier error que no fuera
 * "credenciales inválidas" caía en un genérico "Ocurrió un error", lo que
 * hacía imposible distinguir (por ejemplo) un correo sin confirmar de
 * demasiados intentos seguidos con solo ver la pantalla.
 */
function mensajeDeErrorAuth(authError: { message: string; status?: number }): string {
  const msg = authError.message.toLowerCase()
  if (msg.includes('invalid login')) {
    return 'Correo/código o contraseña incorrectos. Intenta de nuevo.'
  }
  if (msg.includes('email not confirmed')) {
    return 'Tu correo todavía no fue confirmado. Pide a la secretaría que reenvíe la invitación.'
  }
  if (authError.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentar.'
  }
  return 'Ocurrió un error. Por favor intenta más tarde.'
}

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      // El personal y los tutores escriben su correo; los estudiantes solo
      // su código de acceso (no tienen correo), y aquí se le agrega el
      // dominio interno para convertirlo en la identidad de Auth.
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: normalizeLoginIdentifier(email),
        password,
      })

      if (authError) {
        setError(mensajeDeErrorAuth(authError))
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
    } catch (unexpectedError) {
      // signInWithPassword en teoría siempre atrapa sus propios errores de red
      // y los devuelve como `authError` arriba -- pero con señal inestable
      // (datos móviles, cambio de wifi a datos a medio login) el fetch interno
      // puede rechazar en vez de resolver. Sin este catch, eso dejaba el botón
      // trabado en "Verificando..." para siempre, sin ningún mensaje: exactamente
      // lo que se reportó desde un teléfono y nunca desde una PC con wifi estable.
      setError('No se pudo conectar. Revisa tu conexión a internet e intenta de nuevo.')
      if (process.env.NODE_ENV === 'development') {
        console.error('Fallo inesperado al iniciar sesión:', unexpectedError)
      }
      setLoading(false)
    }
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

    </form>
  )
}
