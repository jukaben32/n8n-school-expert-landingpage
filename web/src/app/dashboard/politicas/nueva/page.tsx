import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import NewPolicyForm from './NewPolicyForm'

export const metadata: Metadata = {
  title: 'Nueva política interna — MentorIApp',
}

export default async function NuevaPoliticaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !canAccess(profile.role, 'politicas_gestionar')) redirect('/dashboard/politicas')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/politicas" className="text-sm font-semibold" style={{ color: 'var(--dash-accent-light)' }}>
        ← Políticas internas
      </Link>
      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Nueva política interna</h1>
        <p className="text-sm text-slate-500 mt-1">
          Todo el personal la verá y la podrá firmar. Una vez publicada, el texto no se edita: si cambia, publica una
          nueva y retira la anterior (así cada firma corresponde al texto exacto que se aceptó).
        </p>
      </div>
      <NewPolicyForm />
    </div>
  )
}
