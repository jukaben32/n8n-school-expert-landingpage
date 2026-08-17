import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoginForm from './LoginForm'

export const metadata: Metadata = {
  title: 'Iniciar Sesión — MentorIApp',
  description: 'Accede al portal escolar de tu institución.',
}

/**
 * Página de Login — MentorIApp
 * Si el usuario ya tiene sesión activa, se redirige al dashboard.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const redirectTo = (await searchParams).redirect
    const isSafeRedirect = !!redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
    redirect(isSafeRedirect ? redirectTo : '/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-white to-accent/10 dark:from-slate-950 dark:via-slate-900 dark:to-primary-dark/20 px-4 py-12">
      <div className="w-full max-w-md">

        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-glow mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422A12.083 12.083 0 0121 13c0 4.418-3.582 8-8 8S5 17.418 5 13c0-.935.164-1.832.463-2.668L12 14z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            MentorIApp
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Portal escolar
          </p>
        </div>

        {/* Tarjeta de login */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-white/70 dark:border-slate-800 rounded-3xl shadow-soft p-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            Bienvenido/a de vuelta
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Ingresa tus credenciales para continuar
          </p>

          <LoginForm />
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">
          ¿Problemas para acceder? Contacta a la secretaría del colegio.
        </p>
      </div>
    </main>
  )
}
