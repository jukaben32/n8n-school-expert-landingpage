import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { getWebsiteSettings } from '@/lib/websiteSettings'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import SchoolWebsiteForm from './SchoolWebsiteForm'

export const metadata: Metadata = {
  title: 'Sitio Web — MentorIApp',
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

  const [{ data: school, error: schoolError }, { data: services }, { data: teamMembers }, { data: testimonials }, { data: faqs }] =
    await Promise.all([
      supabase.from('schools').select('id, name, subdomain, tagline, logo_url, address, phone, email, settings').eq('id', schoolId).single(),
      supabase.from('website_services').select('*').eq('school_id', schoolId).order('sort_order'),
      supabase.from('website_team_members').select('*').eq('school_id', schoolId).order('sort_order'),
      supabase.from('website_testimonials').select('*').eq('school_id', schoolId).order('sort_order'),
      supabase.from('website_faqs').select('*').eq('school_id', schoolId).order('sort_order'),
    ])

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
          El sitio público del colegio, en{' '}
          <a href={`/colegio/${school.subdomain}`} target="_blank" rel="noreferrer" className="text-primary dark:text-accent-light underline">
            /colegio/{school.subdomain}
          </a>
          . Hero, historia, programas, personal destacado, testimonios y preguntas frecuentes.
        </p>
      </div>

      <SchoolWebsiteForm
        school={school}
        initialSettings={getWebsiteSettings(school.settings)}
        initialServices={services ?? []}
        initialTeamMembers={teamMembers ?? []}
        initialTestimonials={testimonials ?? []}
        initialFaqs={faqs ?? []}
      />
    </div>
  )
}
