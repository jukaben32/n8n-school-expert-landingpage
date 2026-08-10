import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PLATFORM_NAME } from '@/lib/branding'
import { createClient } from '@/lib/supabase/server'
import { getWebsiteSettings } from '@/lib/websiteSettings'

type SchoolPublic = {
  id: string
  name: string
  subdomain: string
  tagline: string | null
  logo_url: string | null
  address: string | null
  phone: string | null
  email: string | null
  website_settings: Record<string, unknown> | null
}

async function getSchool(subdomain: string): Promise<SchoolPublic | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('schools_public')
    .select('id, name, subdomain, tagline, logo_url, address, phone, email, website_settings')
    .eq('subdomain', subdomain)
    .maybeSingle()
  return data
}

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }): Promise<Metadata> {
  const { subdomain } = await params
  const school = await getSchool(subdomain)
  if (!school) return { title: 'Colegio no encontrado — MentorIA' }
  const website = getWebsiteSettings(school.website_settings)
  return {
    title: `${school.name} — Portal escolar`,
    description: website.hero_subtitle || school.tagline || `Portal escolar de ${school.name}, construido con ${PLATFORM_NAME}.`,
    themeColor: website.primary_color,
    manifest: `/colegio/${subdomain}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: school.name,
      statusBarStyle: 'black-translucent',
    },
    icons: {
      apple: school.logo_url || '/icons/icon-192.png',
    },
  }
}

export default async function SchoolLandingPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  const school = await getSchool(subdomain)
  if (!school) notFound()

  const website = getWebsiteSettings(school.website_settings)
  const heroTitle = website.hero_title || school.name
  const heroSubtitle = website.hero_subtitle || school.tagline || 'Bienvenido al portal escolar. Inicia sesión para ver comunicados, asistencia, pagos y más.'
  const ctaLabel = website.cta_label || 'Iniciar sesión'
  const primaryColor = website.primary_color
  const accentColor = website.accent_color

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-16"
      style={{
        backgroundImage: `radial-gradient(circle at top, ${primaryColor}20 0%, transparent 42%), radial-gradient(circle at bottom right, ${accentColor}18 0%, transparent 36%), linear-gradient(135deg, rgba(255,255,255,0.96), rgba(255,255,255,0.88))`,
      }}
    >
      <div className="w-full max-w-xl text-center">
        <p
          className="text-[11px] font-bold uppercase tracking-[0.35em] mb-4"
          style={{ color: primaryColor }}
        >
          Portal escolar
        </p>

        {/* Logo del colegio, o el ícono genérico si no tiene uno cargado */}
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl shadow-glow mb-6 overflow-hidden border"
          style={{ backgroundColor: primaryColor, borderColor: `${primaryColor}22` }}
        >
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

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
          {heroTitle}
        </h1>
        <p className="text-slate-600 mt-4 leading-relaxed max-w-2xl mx-auto text-base sm:text-lg">
          {heroSubtitle}
        </p>

        <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full text-white font-semibold px-7 py-3.5 text-sm transition shadow-glow"
            style={{
              backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
              boxShadow: `0 20px 45px ${primaryColor}30`,
            }}
          >
            {ctaLabel}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
            </svg>
          </Link>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          ¿No tienes cuenta todavía? Pídele acceso a la administración de tu colegio.
        </p>

        {(school.address || school.phone || school.email) && (
          <div
            className="mt-12 rounded-3xl border bg-white/80 backdrop-blur px-6 py-5 text-xs text-slate-500 shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
            style={{ borderColor: `${primaryColor}18` }}
          >
            <p className="font-semibold uppercase tracking-[0.25em] mb-2" style={{ color: primaryColor }}>
              Datos de contacto
            </p>
            {school.address && <p>{school.address}</p>}
            <p className="mt-1">
              {school.phone && <span>{school.phone}</span>}
              {school.phone && school.email && <span> · </span>}
              {school.email && <span>{school.email}</span>}
            </p>
          </div>
        )}

        <p className="mt-10 text-[11px] font-mono uppercase tracking-widest text-slate-400">
          Construido con {PLATFORM_NAME}
        </p>
      </div>
    </main>
  )
}
