import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ManualFamilyAccessPanel from './ManualFamilyAccessPanel'

export const metadata: Metadata = {
  title: 'Acceso familiar manual — MentorIApp',
  description: 'Genera codigos manuales para que secretaria los envie por WhatsApp Business.',
}

export default async function AccesoFamiliarManualPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  const allowedRoles = ['super_admin', 'school_admin', 'director', 'reception']
  if (!profile || !allowedRoles.includes(profile.role)) redirect('/dashboard')

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/dashboard/secretaria" className="text-sm hover:underline" style={{ color: 'var(--dash-accent)' }}>
          ← Centro de control
        </Link>
        <h1 className="mt-2 text-2xl font-bold font-barlow text-slate-900 tracking-tight">
          Acceso familiar manual
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
          Herramienta de transicion para generar codigos y enviarlos manualmente por WhatsApp Business.
          Usala con pocas familias por dia y solo despues de confirmar el celular del tutor.
        </p>
      </div>

      <ManualFamilyAccessPanel />
    </div>
  )
}
