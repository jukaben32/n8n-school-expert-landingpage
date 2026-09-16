import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PLATFORM_NAME } from '@/lib/branding'
import InquiryForm from '../InquiryForm'
import FloatingWhatsAppButton from '@/components/FloatingWhatsAppButton'

// Paleta de la campaña de Admisiones 2026-2027, dada por el colegio --
// deliberadamente distinta de website_settings.primaryColor/accentColor
// (esos son configurables por el sitio general del colegio; esta es una
// página de campaña aparte, con su propia identidad).
const NAVY = '#0d3b66'
const RED = '#e63946'
const GOLD = '#f4a261'

type SchoolRow = {
  id: string
  name: string
  subdomain: string
  logo_url: string | null
  whatsapp_active: boolean
  whatsapp_phone_number: string | null
}

async function getSchool(subdomain: string): Promise<SchoolRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('schools_public')
    .select('id, name, subdomain, logo_url, whatsapp_active, whatsapp_phone_number')
    .eq('subdomain', subdomain)
    .maybeSingle()
  return data
}

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }): Promise<Metadata> {
  const { subdomain } = await params
  const school = await getSchool(subdomain)
  if (!school) return { title: 'Colegio no encontrado — ' + PLATFORM_NAME }

  const title = `Admisiones 2026-2027 — ${school.name}`
  const description = `Solicita la admisión de tu hijo/a para el período 2026-2027 en ${school.name}. Más de 20 años formando mentes creativas, valores firmes y líderes bilingües preparados para transformar el futuro.`

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      siteName: school.name,
      title,
      description,
      locale: 'es_DO',
      images: school.logo_url ? [{ url: school.logo_url, alt: school.name }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: school.logo_url ? [school.logo_url] : undefined,
    },
  }
}

type Nivel = { emoji: string; titulo: string; detalle: string; href?: string }

const NIVELES: Nivel[] = [
  {
    emoji: '🧸',
    titulo: 'Nivel Inicial',
    detalle: 'Pre-Kínder, Kínder y Pre-Primario. Primeros pasos con juego, curiosidad y mucho cariño.',
  },
  {
    emoji: '✏️',
    titulo: 'Nivel Primario',
    detalle: '1ro a 6to. Bases sólidas en Lengua Española, Matemática, Ciencias y valores.',
  },
  {
    emoji: '🎓',
    titulo: 'Nivel Secundario',
    detalle: '1ro a 6to. Preparación académica exigente, con miras a la universidad y a la vida.',
  },
  {
    emoji: '🌎',
    titulo: 'Inglés — Alianza con Amco',
    detalle: 'Programa de inglés estructurado por ciclos, en alianza con Amco, para estudiantes realmente bilingües.',
    // TODO: pendiente el enlace de Amco que dará el colegio.
  },
  {
    emoji: '💻',
    titulo: 'Portal Familiar',
    detalle: 'Sigue en tiempo real asistencia, calificaciones, comunicados y pagos de tus hijos, desde el celular.',
    href: 'https://www.educacionmanantial.com',
  },
]

const PASOS_ADMISION = [
  { numero: '1', titulo: 'Solicita tu cupo', detalle: 'Completa el formulario con tus datos y los de tu hijo/a.' },
  { numero: '2', titulo: 'Te contactamos', detalle: 'Nuestro equipo te escribe o llama para coordinar los siguientes pasos.' },
  { numero: '3', titulo: 'Entrega de documentos', detalle: 'Te indicamos exactamente qué papeles necesitamos según el grado.' },
  { numero: '4', titulo: '¡Bienvenido a la familia!', detalle: 'Confirmamos el cupo y te acompañamos en todo el proceso de matrícula.' },
]

export default async function AdmisionesPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  const school = await getSchool(subdomain)
  if (!school) notFound()

  return (
    <main className="min-h-screen bg-white overflow-x-hidden">
      <style>{`
        @keyframes admisiones-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-14px) rotate(6deg); }
        }
        @keyframes admisiones-float-slow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(-6deg); }
        }
        @keyframes admisiones-pop {
          from { transform: scale(.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes admisiones-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }
        .admisiones-float { animation: admisiones-float 5s ease-in-out infinite; }
        .admisiones-float-slow { animation: admisiones-float-slow 6.5s ease-in-out infinite; }
        .admisiones-pop { animation: admisiones-pop .7s cubic-bezier(.16,1,.3,1) both; }
        .admisiones-bounce { animation: admisiones-bounce 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .admisiones-float, .admisiones-float-slow, .admisiones-pop, .admisiones-bounce { animation: none; }
        }
      `}</style>

      {/* Hero */}
      <section
        className="relative overflow-hidden px-4 py-20 sm:py-28 text-center"
        style={{
          background: `radial-gradient(circle at 12% 18%, ${GOLD}26 0%, transparent 45%), radial-gradient(circle at 88% 14%, ${RED}1f 0%, transparent 42%), radial-gradient(circle at 50% 100%, ${NAVY}14 0%, transparent 50%), linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%)`,
        }}
      >
        <span aria-hidden className="hidden sm:block absolute left-[6%] top-16 text-4xl admisiones-float select-none">🎒</span>
        <span aria-hidden className="hidden sm:block absolute right-[8%] top-24 text-4xl admisiones-float-slow select-none">📚</span>
        <span aria-hidden className="hidden sm:block absolute left-[10%] bottom-16 text-3xl admisiones-float-slow select-none">🎨</span>
        <span aria-hidden className="hidden sm:block absolute right-[12%] bottom-20 text-3xl admisiones-float select-none">✏️</span>

        <div className="relative max-w-3xl mx-auto admisiones-pop">
          {school.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={school.logo_url}
              alt={school.name}
              className="mx-auto mb-6 h-20 w-20 rounded-2xl object-cover shadow-lg border-4 border-white"
            />
          )}

          <span
            className="inline-block rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest mb-5"
            style={{ backgroundColor: `${NAVY}14`, color: NAVY }}
          >
            {school.name} · Admisiones abiertas
          </span>

          <h1 className="text-3xl sm:text-5xl font-black leading-tight" style={{ color: NAVY }}>
            🌟 ¡Escribe tu propia historia con nosotros!
          </h1>

          <h2 className="mt-3 text-xl sm:text-2xl font-bold" style={{ color: RED }}>
            Bienvenidos al período escolar 2026-2027
          </h2>

          <p className="mt-5 text-slate-600 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Más de 20 años formando mentes creativas, valores firmes y líderes bilingües preparados para
            transformar el futuro.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
            <a
              href="#admisiones"
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
              style={{ backgroundColor: NAVY, boxShadow: `0 16px 34px ${NAVY}35` }}
            >
              Solicitar Admisión 2026-2027
            </a>
            <a
              href="#oferta-academica"
              className="inline-flex items-center gap-2 rounded-xl border-2 px-7 py-3 text-sm font-bold transition hover:-translate-y-0.5"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              Conoce Nuestra Oferta Académica
            </a>
          </div>

          <a
            href="#oferta-academica"
            aria-label="Bajar a Oferta Académica"
            className="admisiones-bounce mt-14 inline-flex text-2xl opacity-60"
          >
            ↓
          </a>
        </div>
      </section>

      {/* Oferta académica */}
      <section id="oferta-academica" className="px-4 py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.3em] mb-2" style={{ color: RED }}>
            Oferta académica
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-12" style={{ color: NAVY }}>
            Un camino completo, de Inicial a Bachillerato
          </h2>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {NIVELES.map((n) => {
              const cardClass =
                'rounded-2xl bg-white border border-slate-100 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg block'
              const content = (
                <>
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                    style={{ backgroundColor: `${NAVY}0f` }}
                  >
                    {n.emoji}
                  </div>
                  <p className="font-bold flex items-center gap-1.5" style={{ color: NAVY }}>
                    {n.titulo}
                    {n.href && (
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18m0 0v4.5M18 6l-7.5 7.5M6 12v6a1 1 0 001 1h11a1 1 0 001-1v-5" />
                      </svg>
                    )}
                  </p>
                  <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{n.detalle}</p>
                </>
              )

              return n.href ? (
                <a key={n.titulo} href={n.href} target="_blank" rel="noreferrer" className={cardClass}>
                  {content}
                </a>
              ) : (
                <div key={n.titulo} className={cardClass}>
                  {content}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Admisiones */}
      <section id="admisiones" className="px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.3em] mb-2" style={{ color: RED }}>
            Proceso de admisión
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-12" style={{ color: NAVY }}>
            Cuatro pasos para asegurar el cupo de tu hijo/a
          </h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-14">
            {PASOS_ADMISION.map((p) => (
              <div key={p.numero} className="text-center px-2">
                <div
                  className="mx-auto w-11 h-11 rounded-full flex items-center justify-center font-black text-white mb-3"
                  style={{ backgroundColor: p.numero === '4' ? GOLD : NAVY }}
                >
                  {p.numero}
                </div>
                <p className="font-bold text-slate-900">{p.titulo}</p>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{p.detalle}</p>
              </div>
            ))}
          </div>

          <div className="max-w-md mx-auto">
            <InquiryForm schoolId={school.id} primaryColor={NAVY} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 border-t border-slate-100 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} {school.name}. Todos los derechos reservados.</p>
        <p className="mt-2 text-[11px] font-mono uppercase tracking-widest text-slate-400">
          Construido con {PLATFORM_NAME}
        </p>
      </footer>

      {school.whatsapp_active && school.whatsapp_phone_number && (
        <FloatingWhatsAppButton
          phoneNumber={school.whatsapp_phone_number}
          message={`Hola, quiero información sobre las admisiones 2026-2027 en ${school.name}`}
        />
      )}
    </main>
  )
}
