import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PLATFORM_NAME } from '@/lib/branding'
import { createClient } from '@/lib/supabase/server'
import { getWebsiteSettings, type SchoolWebsiteSettings } from '@/lib/websiteSettings'

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

type ServiceRow = { icon: string; name: string; description: string | null; duration: string | null; price: string | null }
type TeamRow = { name: string; role: string; bio: string | null; photo_url: string | null }
type TestimonialRow = { quote: string; author_name: string; author_role: string | null; rating: number }
type FaqRow = { question: string; answer: string }

async function getSchool(subdomain: string): Promise<SchoolPublic | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('schools_public')
    .select('id, name, subdomain, tagline, logo_url, address, phone, email, website_settings')
    .eq('subdomain', subdomain)
    .maybeSingle()
  return data
}

async function getWebsiteLists(schoolId: string) {
  const supabase = await createClient()
  const [{ data: services }, { data: team }, { data: testimonials }, { data: faqs }] = await Promise.all([
    supabase.from('website_services').select('icon, name, description, duration, price').eq('school_id', schoolId).order('sort_order'),
    supabase.from('website_team_members').select('name, role, bio, photo_url').eq('school_id', schoolId).order('sort_order'),
    supabase.from('website_testimonials').select('quote, author_name, author_role, rating').eq('school_id', schoolId).order('sort_order'),
    supabase.from('website_faqs').select('question, answer').eq('school_id', schoolId).order('sort_order'),
  ])
  return {
    services: (services ?? []) as ServiceRow[],
    team: (team ?? []) as TeamRow[],
    testimonials: (testimonials ?? []) as TestimonialRow[],
    faqs: (faqs ?? []) as FaqRow[],
  }
}

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }): Promise<Metadata> {
  const { subdomain } = await params
  const school = await getSchool(subdomain)
  if (!school) return { title: 'Colegio no encontrado — MentorIA' }
  const website = getWebsiteSettings(school.website_settings)
  return {
    title: `${school.name} — Portal escolar`,
    description: website.heroSubtitle || school.tagline || `Portal escolar de ${school.name}, construido con ${PLATFORM_NAME}.`,
    themeColor: website.primaryColor,
    manifest: `/colegio/${subdomain}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: school.name, statusBarStyle: 'black-translucent' },
    icons: { apple: school.logo_url || '/icons/icon-192.png' },
  }
}

function SocialLinks({ website }: { website: SchoolWebsiteSettings }) {
  const links = [
    { url: website.socialFacebook, label: 'Facebook' },
    { url: website.socialInstagram, label: 'Instagram' },
    { url: website.socialYoutube, label: 'YouTube' },
    { url: website.socialTiktok, label: 'TikTok' },
    { url: website.socialLinkedin, label: 'LinkedIn' },
  ].filter((l) => l.url)
  if (!links.length) return null
  return (
    <div className="flex items-center justify-center gap-4 flex-wrap">
      {links.map((l) => (
        <a key={l.label} href={l.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline">
          {l.label}
        </a>
      ))}
    </div>
  )
}

export default async function SchoolLandingPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  const school = await getSchool(subdomain)
  if (!school) notFound()

  const website = getWebsiteSettings(school.website_settings)

  if (!website.isPublished) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{school.name}</h1>
          <p className="text-slate-500 mt-3">El sitio público de este colegio estará disponible próximamente.</p>
          <Link href="/login" className="inline-block mt-6 text-sm font-semibold underline text-slate-700">
            Iniciar sesión
          </Link>
        </div>
      </main>
    )
  }

  const { services, team, testimonials, faqs } = await getWebsiteLists(school.id)

  const heroTitle = website.heroTitle || school.name
  const heroSubtitle = website.heroSubtitle || school.tagline || 'Bienvenido al portal escolar. Inicia sesión para ver comunicados, asistencia, pagos y más.'
  const { primaryColor, accentColor } = website
  const stats = [
    website.yearsFounded ? { label: 'Fundado en', value: website.yearsFounded } : null,
    website.studentsCount ? { label: 'Estudiantes', value: website.studentsCount } : null,
    website.satisfactionPct ? { label: 'Satisfacción', value: `${website.satisfactionPct}%` } : null,
  ].filter((s): s is { label: string; value: string } => !!s)

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section
        className="flex items-center justify-center px-4 py-16"
        style={{
          backgroundImage: `radial-gradient(circle at top, ${primaryColor}20 0%, transparent 42%), radial-gradient(circle at bottom right, ${accentColor}18 0%, transparent 36%), linear-gradient(135deg, rgba(255,255,255,0.96), rgba(255,255,255,0.88))`,
        }}
      >
        <div className="w-full max-w-xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] mb-4" style={{ color: primaryColor }}>
            Portal escolar
          </p>

          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl shadow-glow mb-6 overflow-hidden border" style={{ backgroundColor: primaryColor, borderColor: `${primaryColor}22` }}>
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

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">{heroTitle}</h1>
          <p className="text-slate-600 mt-4 leading-relaxed max-w-2xl mx-auto text-base sm:text-lg">{heroSubtitle}</p>

          <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full text-white font-semibold px-7 py-3.5 text-sm transition shadow-glow"
              style={{ backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`, boxShadow: `0 20px 45px ${primaryColor}30` }}
            >
              {website.ctaLabel || 'Iniciar sesión'}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </Link>
            {website.ctaSecondaryLabel && (
              <a href="#contacto" className="inline-flex items-center gap-2 rounded-full border border-slate-200 font-semibold px-7 py-3.5 text-sm text-slate-700">
                {website.ctaSecondaryLabel}
              </a>
            )}
          </div>

          <p className="mt-6 text-xs text-slate-500">¿No tienes cuenta todavía? Pídele acceso a la administración de tu colegio.</p>
        </div>
      </section>

      {stats.length > 0 && (
        <section className="py-8 border-y border-slate-100 bg-slate-50">
          <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4 text-center px-4">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-black text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sobre nosotros */}
      {(website.aboutStory || website.aboutPhotoUrl) && (
        <section className="max-w-5xl mx-auto px-4 py-16 grid gap-8 sm:grid-cols-2 items-center">
          {website.aboutPhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={website.aboutPhotoUrl} alt={website.aboutTitle} className="rounded-2xl w-full h-64 object-cover order-1 sm:order-none" />
          )}
          <div>
            <h2 className="text-2xl font-black text-slate-900">{website.aboutTitle}</h2>
            <p className="text-slate-600 mt-3 leading-relaxed whitespace-pre-wrap">{website.aboutStory}</p>
            {website.trustBadges.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {website.trustBadges.map((b) => (
                  <span key={b} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{b}</span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Programas y servicios */}
      {services.length > 0 && (
        <section className="bg-slate-50 py-16">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl font-black text-slate-900 text-center mb-10">Programas y servicios</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s, i) => (
                <div key={i} className="rounded-2xl bg-white border border-slate-100 p-5">
                  <p className="font-bold text-slate-900">{s.name}</p>
                  {s.description && <p className="text-sm text-slate-600 mt-1.5">{s.description}</p>}
                  {(s.duration || s.price) && (
                    <p className="text-xs text-slate-400 mt-3">{[s.duration, s.price].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Personal destacado */}
      {team.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-black text-slate-900 text-center mb-10">Nuestro equipo</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((m, i) => (
              <div key={i} className="text-center">
                <div className="w-24 h-24 rounded-full bg-slate-100 mx-auto overflow-hidden">
                  {m.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo_url} alt={m.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <p className="font-bold text-slate-900 mt-3">{m.name}</p>
                <p className="text-xs text-slate-500">{m.role}</p>
                {m.bio && <p className="text-xs text-slate-400 mt-1.5">{m.bio}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Testimonios */}
      {testimonials.length > 0 && (
        <section className="bg-slate-50 py-16">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl font-black text-slate-900 text-center mb-10">Lo que dicen las familias</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t, i) => (
                <div key={i} className="rounded-2xl bg-white border border-slate-100 p-5">
                  <p className="text-amber-500 text-sm">{'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}</p>
                  <p className="text-sm text-slate-600 mt-2 italic">&ldquo;{t.quote}&rdquo;</p>
                  <p className="text-xs font-semibold text-slate-900 mt-3">{t.author_name}</p>
                  {t.author_role && <p className="text-xs text-slate-400">{t.author_role}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQs */}
      {faqs.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-black text-slate-900 text-center mb-10">Preguntas frecuentes</h2>
          <div className="space-y-4">
            {faqs.map((f, i) => (
              <details key={i} className="rounded-xl border border-slate-100 p-4">
                <summary className="font-semibold text-slate-900 cursor-pointer">{f.question}</summary>
                <p className="text-sm text-slate-600 mt-2">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Contacto */}
      <section id="contacto" className="bg-slate-50 py-16 px-4 text-center">
        {(school.address || school.phone || school.email || website.contactHours) && (
          <div className="mx-auto max-w-md rounded-3xl border bg-white/80 backdrop-blur px-6 py-5 text-xs text-slate-500 shadow-[0_20px_50px_rgba(15,23,42,0.06)]" style={{ borderColor: `${primaryColor}18` }}>
            <p className="font-semibold uppercase tracking-[0.25em] mb-2" style={{ color: primaryColor }}>Datos de contacto</p>
            {school.address && <p>{school.address}</p>}
            <p className="mt-1">
              {school.phone && <span>{school.phone}</span>}
              {school.phone && school.email && <span> · </span>}
              {school.email && <span>{school.email}</span>}
            </p>
            {website.contactHours && <p className="mt-1">{website.contactHours}</p>}
            {website.contactMapsUrl && (
              <a href={website.contactMapsUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 underline font-semibold" style={{ color: primaryColor }}>
                Ver mapa
              </a>
            )}
          </div>
        )}

        <div className="mt-6">
          <SocialLinks website={website} />
        </div>

        {website.footerTagline && <p className="mt-6 text-sm text-slate-500">{website.footerTagline}</p>}
        <p className="mt-10 text-[11px] font-mono uppercase tracking-widest text-slate-400">Construido con {PLATFORM_NAME}</p>
      </section>
    </main>
  )
}
