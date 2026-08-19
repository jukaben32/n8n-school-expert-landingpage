import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StaffRegistrationForm from './StaffRegistrationForm'

async function getSchool(subdomain: string) {
  const supabase = await createClient()
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
  return { title: `Registro de personal — ${school.name}` }
}

/**
 * Formulario público de autorregistro de personal -- pensado para
 * compartirse por WhatsApp con todo el equipo del colegio de una sola vez.
 * Cada persona completa sus propios datos (correo, teléfono, cédula,
 * ficha profesional); nunca se crea el registro real de `staff`
 * directamente desde aquí -- queda en `staff_registrations` como
 * "pendiente" hasta que dirección lo revise y apruebe en
 * /dashboard/personal/registros. Mismo patrón que `leads` (landing
 * pública) y las fichas de inscripción escaneadas.
 */
export default async function RegistroPersonalPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  const school = await getSchool(subdomain)
  if (!school) notFound()

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-light mb-2">{school.name}</p>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Registro de personal</h1>
          <p className="text-white/60 text-sm mt-2">
            Completa tus datos y tu ficha profesional. La dirección revisa cada registro antes de activarlo.
          </p>
        </div>
        <StaffRegistrationForm schoolId={school.id} />
      </div>
    </div>
  )
}
