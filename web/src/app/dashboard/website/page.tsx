import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import SchoolWebsiteForm from './SchoolWebsiteForm'

export const metadata: Metadata = {
  title: 'Sitio Web â€” MentorIApp',
}

export default async function WebsitePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  if (!profile || !canAccess(profile.role, 'website')) {
    redirect('/dashboard')
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('id, name, subdomain, tagline, logo_url, address, phone, email, settings')
    .eq('id', schoolId)
    .single()

  if (!school) redirect('/dashboard')

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'la configuración del sitio web', error: schoolError }]} />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary dark:text-accent-light">
          Setup
        </p>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Sitio Web
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-3xl leading-6">
          Completa la identidad pública del colegio: hero, logo y colores. Esta hoja queda separada de la
          configuración operativa para mantener todo ordenado.
        </p>
      </div>

      <SchoolWebsiteForm school={school} />
    </div>
  )
}
