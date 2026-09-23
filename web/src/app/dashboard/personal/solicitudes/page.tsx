import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import JobApplicationsReview from './JobApplicationsReview'

export const metadata: Metadata = {
  title: 'Solicitudes de empleo — MentorIApp',
}

export default async function SolicitudesEmpleoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !canAccess(profile.role, 'personal')) redirect('/dashboard')
  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  // Cliente de sesión: la RLS solo le abre esta tabla a dirección.
  const [{ data: apps, error }, { data: school }] = await Promise.all([
    supabase.from('job_applications').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(300),
    supabase.from('schools').select('subdomain').eq('id', schoolId).maybeSingle(),
  ])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/personal" className="text-sm font-semibold" style={{ color: 'var(--dash-accent-light)' }}>
        ← Personal
      </Link>
      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Solicitudes de empleo</h1>
        <p className="text-sm text-slate-500 mt-1">
          Lo que envían los postulantes desde la página web del colegio
          {school?.subdomain ? <> (<Link className="underline" href={`/colegio/${school.subdomain}/empleo`} target="_blank">ver el formulario</Link>)</> : null}.
          Nada de esto crea personal: si contratas a alguien, agrégalo en Personal.
        </p>
      </div>
      <QueryErrorBanner errors={[{ label: 'solicitudes', error }]} />
      <JobApplicationsReview applications={apps ?? []} />
    </div>
  )
}
