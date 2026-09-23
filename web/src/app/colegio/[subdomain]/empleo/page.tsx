import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/publicClient'
import JobApplicationForm from './JobApplicationForm'

async function getSchool(subdomain: string) {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('schools_public')
    .select('id, name, subdomain')
    .eq('subdomain', subdomain)
    .maybeSingle()
  return data
}

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }): Promise<Metadata> {
  const { subdomain } = await params
  const school = await getSchool(subdomain)
  if (!school) return { title: 'Colegio no encontrado — MentorIApp' }
  return {
    title: `Trabaja con nosotros — ${school.name}`,
    description: `Solicitud de empleo para personal docente y administrativo de ${school.name}.`,
  }
}

/**
 * Solicitud de empleo pública (sin login). Reemplaza el formulario en papel
 * "Solicitud de Empleo - Personal Docente y Administrativo". Nada de lo que
 * se envía aquí crea personal: queda en `job_applications` para que
 * dirección lo revise en /dashboard/personal/solicitudes.
 */
export default async function EmpleoPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  const school = await getSchool(subdomain)
  if (!school) notFound()

  return (
    <div className="min-h-screen bg-ink px-5 py-12">
      <div className="w-full max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Link href={`/colegio/${subdomain}`} className="text-xs font-semibold uppercase tracking-widest text-accent-light">
            {school.name}
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-2">Solicitud de empleo</h1>
          <p className="text-white/60 text-sm mt-2">
            Personal docente y administrativo. Completa el formulario y adjunta tu currículum (CV) actualizado y tus
            certificaciones académicas. La dirección revisa cada solicitud.
          </p>
        </div>
        <JobApplicationForm schoolId={school.id} />
      </div>
    </div>
  )
}
