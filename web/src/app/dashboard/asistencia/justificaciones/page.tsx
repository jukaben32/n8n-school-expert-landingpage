import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { listPendingJustifications } from './actions'
import JustificationsReview from './JustificationsReview'

export const metadata: Metadata = {
  title: 'Justificaciones de ausencia — MentorIApp',
  description: 'Revisa las justificaciones de ausencia que envían las familias.',
}

export default async function JustificacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')

  // Mismo permiso que Asistencia: quien marca la falta revisa su
  // justificación. El profesor, además, solo ve las de SUS grados -- eso
  // lo impone la RLS, no esta comprobación.
  if (!profile || !canAccess(profile.role, 'asistencia')) {
    redirect('/dashboard')
  }

  const pendientes = await listPendingJustifications()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">
          Justificaciones de ausencia
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Lo que enviaron las familias para explicar una falta. Aceptar marca esa asistencia como justificada.
        </p>
      </div>

      <JustificationsReview initial={pendientes} />
    </div>
  )
}
