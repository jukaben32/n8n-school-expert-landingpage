import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Phone, Mail, MapPin, Clock, Facebook, Instagram, Youtube, Linkedin, Music2 } from 'lucide-react'
import { PLATFORM_NAME } from '@/lib/branding'
import { createClient } from '@/lib/supabase/server'
import { getWebsiteSettings, type SchoolWebsiteSettings } from '@/lib/websiteSettings'
import InquiryForm from './InquiryForm'
import InstallAppButton from './InstallAppButton'
import FloatingWhatsAppButton from '@/components/FloatingWhatsAppButton'

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
  whatsapp_active: boolean
  whatsapp_phone_number: string | null
}

type ServiceRow = { icon: string; name: string; description: string | null; duration: string | null; price: string | null }
type TeamRow = { name: string; role: string; bio: string | null; photo_url: string | null }
type TestimonialRow = { quote: string; author_name: string; author_role: string | null; rating: number }
type FaqRow = { question: string; answer: string }

async function getSchool(subdomain: string): Promise<SchoolPublic | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('schools_public')
    .select('id, name, subdomain, tagline, logo_url, address, phone, email, website_settings, whatsapp_active, whatsapp_phone_number')
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
    { url: website.socialFacebook, label: 'Facebook', icon: Facebook },
    { url: website.socialInstagram, label: 'Instagram', icon: Instagram },
    { url: website.socialYoutube, label: 'YouTube', icon: Youtube },
    { url: website.socialTiktok, label: 'TikTok', icon: Music2 },
    { url: website.socialLinkedin, label: 'LinkedIn', icon: Linkedin },
  ].filter((l): l is { url: string; label: string; icon: typeof Facebook } => Boolean(l.url))
  if (!links.length) return null
  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.url}
          target="_blank"
          rel="noreferrer"
          aria-label={l.label}
          className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:-translate-y-0.5"
          style={{ backgroundColor: website.primaryColor }}
        >
          <l.icon className="h-4 w-4" />
        </a>
      ))}
    </div>
  )
}

function ContactRow({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Phone
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid place-items-center w-9 h-9 rounded-lg shrink-0" style={{ backgroundColor: `${accent}1A`, color: accent }}>
        <Icon className="w-4 h-4" />
      </span>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="font-medium text-slate-800 whitespace-pre-line">{value}</p>
      </div>
    </div>
  )
}

// Convierte un enlace normal de Google Maps (o uno ya de /maps/embed) en una
// URL que sí puede vivir en un <iframe> -- si no es reconocible, lo trata
// como una dirección de búsqueda de todos modos. Mantiene solo el caso
// común (a diferencia de la referencia no intenta parsear coordenadas
// DMS sueltas -- un colegio simplemente pega el enlace que Google le dio).
function normalizeMapEmbedUrl(rawValue: string | undefined): string | null {
  const value = rawValue?.trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      const isGoogleMap = url.hostname.toLowerCase().includes('google.') || url.hostname === 'maps.app.goo.gl' || url.hostname === 'goo.gl'
      const isEmbed = url.pathname.includes('/maps/embed') || url.searchParams.get('output') === 'embed'
      if (isGoogleMap && isEmbed) return value
      if (!isGoogleMap) return value
    } catch {
      // sigue abajo, lo trata como texto de búsqueda
    }
  }
  return `https://maps.google.com/maps?q=${encodeURIComponent(value)}&output=embed`
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
  const mapEmbedUrl = normalizeMapEmbedUrl(website.contactMapsUrl)

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
            <InstallAppButton primaryColor={primaryColor} />
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
      <section id="contacto" className="bg-slate-50 py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] mb-2 text-center" style={{ color: primaryColor }}>
            Contáctanos
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 text-center mb-10">Hablemos</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {school.phone && <ContactRow icon={Phone} label="Teléfono" value={school.phone} accent={primaryColor} />}
              {school.email && <ContactRow icon={Mail} label="Correo" value={school.email} accent={primaryColor} />}
              {school.address && <ContactRow icon={MapPin} label="Dirección" value={school.address} accent={primaryColor} />}
              {website.contactHours && <ContactRow icon={Clock} label="Horario" value={website.contactHours} accent={primaryColor} />}

              {mapEmbedUrl && (
                <div className="rounded-2xl overflow-hidden min-h-[220px] bg-slate-200">
                  <iframe src={mapEmbedUrl} className="w-full h-full min-h-[220px] border-0" loading="lazy" title="Ubicación" />
                </div>
              )}
            </div>

            <InquiryForm schoolId={school.id} primaryColor={primaryColor} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 sm:px-10 py-10 border-t border-slate-100 text-center text-xs text-slate-500">
        <div className="flex flex-col items-center gap-4">
          <SocialLinks website={website} />
          <div>
            <p className="mb-1">{website.footerTagline || `Portal escolar de ${school.name}.`}</p>
            <p>© {new Date().getFullYear()} {school.name}. Todos los derechos reservados.</p>
          </div>
          <p className="mt-2 text-[11px] font-mono uppercase tracking-widest text-slate-400">Construido con {PLATFORM_NAME}</p>
        </div>
      </footer>

      {school.whatsapp_active && school.whatsapp_phone_number && (
        <FloatingWhatsAppButton
          phoneNumber={school.whatsapp_phone_number}
          message={`Hola, tengo una pregunta sobre ${school.name}`}
        />
      )}
    </main>
  )
}
