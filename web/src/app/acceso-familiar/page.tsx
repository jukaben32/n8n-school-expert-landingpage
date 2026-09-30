import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FamilyPhoneAccessForm from './FamilyPhoneAccessForm'

export const metadata: Metadata = {
  title: 'Acceso Familiar — MentorIApp',
  description: 'Acceso al Portal Familiar con celular y codigo de WhatsApp.',
}

export default async function AccesoFamiliarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard/portal-familiar')

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-white to-accent/10 dark:from-slate-950 dark:via-slate-900 dark:to-primary-dark/20 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-glow mb-4">
            <span className="text-2xl text-white" aria-hidden="true">F</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Portal Familiar
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Acceso con celular y codigo de WhatsApp
          </p>
        </div>

        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-white/70 dark:border-slate-800 rounded-3xl shadow-soft p-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            Entrar como familia
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Usa el celular registrado en el colegio.
          </p>

          <FamilyPhoneAccessForm />
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">
          <Link href="/login" className="hover:text-primary hover:underline">
            Entrar con correo, contraseña o codigo de estudiante
          </Link>
        </p>
      </div>
    </main>
  )
}

