import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { reconcileAlegraPayments } from '@/lib/accounting/reconcileAlegraPayments'

/**
 * Conciliación diaria Alegra → Cuentas por Cobrar.
 *
 * Route Handler y no Server Action a propósito: quien dispara esto es
 * pg_cron desde la base (vía pg_net), no un navegador con sesión -- mismo
 * caso que el callback de Azul y el webhook de WhatsApp, los otros dos
 * route handlers reales del proyecto.
 *
 * Seguridad: cabecera `Authorization: Bearer <CRON_SECRET>`. Sin sesión de
 * por medio, el secreto compartido ES la autorización, así que se compara
 * en tiempo constante. Si `CRON_SECRET` no está configurada, la ruta
 * responde 503 y NO corre nada -- nunca queda abierta por omisión.
 *
 * ⚠️ Esta ruta tiene que estar en `publicPrefixRoutes` de `web/src/proxy.ts`.
 * Si no, el middleware de auth la redirige a /login y la corrida nunca
 * llega -- exactamente el fallo silencioso que ya se vivió con `/sw.js` y
 * con el callback de Azul.
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

/**
 * Resuelve a qué colegio pertenece la cuenta de Alegra configurada.
 *
 * Hoy `ALEGRA_EMAIL`/`ALEGRA_TOKEN` son variables de plataforma y hay un
 * solo colegio afiliado, así que basta con eso. En cuanto haya un segundo
 * colegio, las credenciales de Alegra tienen que pasar a ser por colegio
 * (mismo lugar que las de Azul: `private.school_payment_settings`) --
 * si no, se le atribuirían a un colegio los cobros de otro. Por eso esto
 * falla en vez de adivinar cuando hay más de un colegio y no se dijo cuál.
 */
async function resolveSchoolId(request: NextRequest): Promise<{ ok: true; schoolId: string } | { ok: false; error: string }> {
  const fromQuery = request.nextUrl.searchParams.get('school')
  if (fromQuery) return { ok: true, schoolId: fromQuery }
  if (process.env.ALEGRA_SCHOOL_ID) return { ok: true, schoolId: process.env.ALEGRA_SCHOOL_ID }

  const admin = createAdminClient()
  const { data: schools, error } = await admin.from('schools').select('id').is('deleted_at', null).limit(2)
  if (error) return { ok: false, error: `No se pudo resolver el colegio: ${error.message}` }
  if (!schools || schools.length === 0) return { ok: false, error: 'No hay ningún colegio registrado.' }
  if (schools.length > 1) {
    return {
      ok: false,
      error: 'Hay más de un colegio afiliado: configura ALEGRA_SCHOOL_ID (o pasa ?school=<uuid>) ' +
        'para decir de cuál es esta cuenta de Alegra.',
    }
  }
  return { ok: true, schoolId: schools[0].id as string }
}

async function run(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET no está configurada en el servidor.' }, { status: 503 })
  }
  if (!secretIsValid(request.headers.get('authorization'))) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
  }

  const school = await resolveSchoolId(request)
  if (!school.ok) return NextResponse.json({ ok: false, error: school.error }, { status: 400 })

  const result = await reconcileAlegraPayments({
    schoolId: school.schoolId,
    trigger: request.nextUrl.searchParams.get('manual') === '1' ? 'manual' : 'cron',
  })

  return NextResponse.json({ ok: result.status !== 'error', ...result })
}

export async function POST(request: NextRequest) {
  return run(request)
}

// GET para poder dispararla a mano desde una terminal con el secreto,
// sin montar un formulario. Misma autorización.
export async function GET(request: NextRequest) {
  return run(request)
}
