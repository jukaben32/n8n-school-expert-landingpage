import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendExcellentAccess } from '@/lib/amco/sendExcellentAccess'

/**
 * Envío del acceso a Excellent (Amco) a las familias.
 *
 * Lo dispara pg_cron (vía pg_net) el 16-oct-2026 a las 8:00 am hora RD; ver
 * `20261015010000_amco_excellent_cron.sql`. Mismo patrón y mismas trampas que
 * `/api/cron/alegra`: Route Handler (no hay sesión), autorización por
 * `Authorization: Bearer <CRON_SECRET>` en tiempo constante, y la ruta vive
 * bajo `/api/cron`, que ya está en `publicPrefixRoutes` de `web/src/proxy.ts`.
 *
 * Parámetros: `batch` (default 1), `limit` (familias por corrida, default 60,
 * tope 120), `dry=1` (no envía nada: solo cuenta y lista lo que enviaría),
 * `school` (uuid; si hay un solo colegio se resuelve solo).
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function secretIsValid(header: string | null): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const provided = (header ?? '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET no está configurada.' }, { status: 503 })
  }
  if (!secretIsValid(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const batch = Math.max(1, Number.parseInt(params.get('batch') ?? '1', 10) || 1)
  const limit = Math.min(120, Math.max(1, Number.parseInt(params.get('limit') ?? '60', 10) || 60))
  const dryRun = params.get('dry') === '1'

  let schoolId = params.get('school')
  if (!schoolId) {
    const { data: schools, error } = await createAdminClient().from('schools').select('id').is('deleted_at', null).limit(2)
    if (error) return NextResponse.json({ error: `No se pudo resolver el colegio: ${error.message}` }, { status: 500 })
    if (!schools || schools.length !== 1) {
      return NextResponse.json({ error: 'No hay exactamente un colegio: pasa ?school=<uuid>.' }, { status: 400 })
    }
    schoolId = schools[0].id as string
  }

  try {
    const result = await sendExcellentAccess({ schoolId, batch, limit, dryRun })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/amco-excellent]', err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
