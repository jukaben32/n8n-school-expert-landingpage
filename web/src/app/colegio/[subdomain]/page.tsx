import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SchoolPublic = {
  id: string
  name: string
  subdomain: string
  tagline: string | null
  logo_url: string | null
  address: string | null
  phone: string | null
  email: string | null
}

async function getSchool(subdomain: string): Promise<SchoolPublic | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('schools_public')
    .select('id, name, subdomain, tagline, logo_url, address, phone, email')
    .eq('subdomain', subdomain)
    .maybeSingle()
  return data
}

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }): Promise<Metadata> {
  const { subdomain } = await params
  const school = await getSchool(subdomain)
  if (!school) return { title: 'Colegio no encontrado — MentorIApp' }
  return {
    title: `${school.name} — Portal escolar`,
    description: school.tagline ?? `Portal escolar de ${school.name}, construido con MentorIApp.`,
  }
}

export default async function SchoolLandingPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  const school = await getSchool(subdomain)
  if (!school) notFound()

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-accent/10 dark:from-slate-950 dark:via-slate-900 dark:to-primary-dark/20 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">

        {/* Logo del colegio, o el ícono genérico si no tiene uno cargado */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary shadow-glow mb-6 overflow-hidden">
          {school.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logo_url} alt={school.name} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422A12.083 12.083 0 0121 13c0 4.418-3.582 8-8 8S5 17.418 5 13c0-.935.164-1.832.463-2.668L12 14z" />
            </svg>
          )}
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          {school.name}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-3 leading-relaxed max-w-md mx-auto">
          {school.tagline || 'Bienvenido al portal escolar. Inicia sesión para ver comunicados, asistencia, pagos y más.'}
        </p>

        <div className="mt-8">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold px-7 py-3.5 text-sm transition shadow-glow"
          >
            Iniciar sesión
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
            </svg>
          </Link>
        </div>

        <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
          ¿No tienes cuenta todavía? Pídele acceso a la administración de tu colegio.
        </p>

        {(school.address || school.phone || school.email) && (
          <div className="mt-12 pt-6 border-t border-slate-200/60 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 space-y-1">
            {school.address && <p>{school.address}</p>}
            <p>
              {school.phone && <span>{school.phone}</span>}
              {school.phone && school.email && <span> · </span>}
              {school.email && <span>{school.email}</span>}
            </p>
          </div>
        )}

        <p className="mt-10 text-[11px] font-mono uppercase tracking-widest text-slate-300 dark:text-slate-600">
          Construido con MentorIApp
        </p>
      </div>
    </main>
  )
}
