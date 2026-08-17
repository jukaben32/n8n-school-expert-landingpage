import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Endpoint público del formulario de contacto en /colegio/[subdomain] --
// el visitante no tiene sesión de Supabase, así que usa el cliente admin
// (mismo patrón que el webhook de WhatsApp): confía en el schoolId que la
// propia página pública ya resolvió del subdominio, no en RLS de anon.
const MAX_LEN = { name: 120, phone: 40, email: 160, message: 2000 }

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
  }

  const schoolId = typeof body.schoolId === 'string' ? body.schoolId : ''
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_LEN.name) : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, MAX_LEN.phone) : ''
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, MAX_LEN.email) : ''
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, MAX_LEN.message) : ''

  if (!schoolId || !name || (!phone && !email)) {
    return NextResponse.json({ error: 'Nombre y al menos un teléfono o correo son obligatorios.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: school } = await admin.from('schools').select('id').eq('id', schoolId).maybeSingle()
  if (!school) {
    return NextResponse.json({ error: 'Colegio no encontrado.' }, { status: 404 })
  }

  const { error } = await admin.from('website_inquiries').insert({
    school_id: schoolId,
    name,
    phone: phone || null,
    email: email || null,
    message: message || null,
  })
  if (error) {
    return NextResponse.json({ error: 'No se pudo enviar tu mensaje. Intenta de nuevo.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
