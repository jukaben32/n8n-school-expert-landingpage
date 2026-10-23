import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/publicClient'
import { getWebsiteSettings } from '@/lib/websiteSettings'
import { schoolShowsCardBrands } from '@/lib/payments/cardBrands'
import CardBrandLogos from '@/components/pagos/CardBrandLogos'
import SchoolLegalFooter from '../../SchoolLegalFooter'
import { addressWithCountry, buildPolicy, isPolicySlug } from '../contenido'

type Params = { subdomain: string; politica: string }

// Mismos datos públicos que usa la portada del colegio (vista schools_public)
async function getSchool(subdomain: string) {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('schools_public')
    .select('id, name, subdomain, address, phone, email, website_settings')
    .eq('subdomain', subdomain)
    .maybeSingle()
  return data as {
    id: string; name: string; subdomain: string; address: string | null
    phone: string | null; email: string | null; website_settings: Record<string, unknown> | null
  } | null
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { subdomain, politica } = await params
  const school = await getSchool(subdomain)
  if (!school || !isPolicySlug(politica)) return { title: 'Página no encontrada' }
  const policy = buildPolicy(politica, { name: school.name, address: null, phone: null, email: null, hours: null })
  return { title: `${policy.title} — ${school.name}`, description: policy.summary }
}

export default async function PolicyPage({ params }: { params: Promise<Params> }) {
  const { subdomain, politica } = await params
  if (!isPolicySlug(politica)) notFound()
  const school = await getSchool(subdomain)
  if (!school) notFound()

  const website = getWebsiteSettings(school.website_settings)
  // Igual que la portada: si el colegio no publicó su sitio, no hay políticas públicas
  if (!website.isPublished) notFound()
  const contact = { name: school.name, address: school.address, phone: school.phone, email: school.email, hours: website.contactHours || null }
  const policy = buildPolicy(politica, contact)
  const showCardBrands = await schoolShowsCardBrands(school.id, subdomain)
  const fullAddress = addressWithCountry(school.address)

  return (
    <main className="min-h-screen bg-white text-slate-800">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        <Link href={`/colegio/${subdomain}`} className="text-sm font-semibold underline underline-offset-2" style={{ color: website.primaryColor }}>
          ← {school.name}
        </Link>

        <h1 className="mt-6 text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{policy.title}</h1>
        <p className="mt-3 text-slate-600">{policy.summary}</p>

        {showCardBrands && policy.logos && <CardBrandLogos variant={policy.logos} height={40} className="mt-6 justify-start" />}

        <div className="mt-10 space-y-8">
          {policy.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-bold text-slate-900">{section.heading}</h2>
              {section.paragraphs?.map((p) => (
                <p key={p} className="mt-2 leading-relaxed text-slate-700">{p}</p>
              ))}
              {section.bullets && (
                <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-700">
                  {section.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Servicio al cliente: Azul exige correo y teléfono visibles */}
        <aside className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 space-y-1">
          <p className="font-bold text-slate-900">Servicio al cliente</p>
          {school.email && <p>Correo: <a className="underline" href={`mailto:${school.email}`}>{school.email}</a></p>}
          {school.phone && <p>Teléfono: <a className="underline" href={`tel:${school.phone}`}>{school.phone}</a></p>}
          {contact.hours && <p>Horario: {contact.hours}</p>}
          {fullAddress && <p>Dirección: {fullAddress}</p>}
        </aside>
      </div>

      <footer className="border-t border-slate-100 px-4 py-10 text-center">
        <SchoolLegalFooter subdomain={subdomain} address={school.address} showCardBrands={showCardBrands} />
        <p className="mt-6 text-xs text-slate-500">© {new Date().getFullYear()} {school.name}.</p>
      </footer>
    </main>
  )
}
