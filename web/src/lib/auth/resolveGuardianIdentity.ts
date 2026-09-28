import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type GuardianIdentity =
  | { ok: true; schoolId: string; familyId: string; guardianId: string; profileId: string }
  | { ok: false; error: string }

/**
 * Resuelve la identidad del guardian autenticado (schoolId/familyId/
 * guardianId) desde la sesión de Next.js. Usado por cualquier Server
 * Action de Portal Familiar que necesite delegar en un núcleo
 * server-only que no toca cookies/sesión directamente (answerFamilyQuestion,
 * el flujo de pagos, etc.) -- este es el único lugar donde se toca la
 * sesión antes de pasar a esos núcleos.
 *
 * Se autoriza por `guardian_id` (¿este perfil está vinculado a una ficha
 * de tutor?), no por `role === 'guardian'` -- así, personal que también
 * es padre/madre en el mismo colegio (ej. un profesor con un hijo
 * inscrito) puede usar su "Vista de Familia" sin necesitar una segunda
 * cuenta. Ver AGENTS.md, sección "Doble rol (staff + tutor)".
 *
 * `profileId` es el id de ESTA fila de users_profiles (única por auth_id).
 * Los llamadores deben usar este id como sender_profile_id/autor en vez de
 * volver a buscar "el perfil con este guardian_id" -- guardian_id no es
 * único en users_profiles (dos tutores de la misma familia pueden
 * compartir guardian_id por un vínculo duplicado), así que esa segunda
 * búsqueda con .single() podía fallar con "No se encontró tu perfil." aun
 * con la sesión perfectamente válida. Bug real en producción, 2026-09-28.
 */
export async function resolveGuardianIdentity(): Promise<GuardianIdentity> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, guardian_id, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !profile.guardian_id) {
    return { ok: false, error: 'Solo disponible para tutores/padres de familia.' }
  }

  // Se usa el cliente admin (no RLS) para resolver family_id, siguiendo
  // el mismo principio de filtrado explícito que el resto de los núcleos:
  // no se confía únicamente en RLS para el aislamiento de datos.
  const admin = createAdminClient()
  const { data: guardian } = await admin
    .from('guardians')
    .select('family_id')
    .eq('id', profile.guardian_id)
    .eq('school_id', profile.school_id)
    .single()

  if (!guardian) return { ok: false, error: 'No se encontró tu ficha de tutor.' }

  return {
    ok: true,
    schoolId: profile.school_id as string,
    familyId: guardian.family_id as string,
    guardianId: profile.guardian_id as string,
    profileId: profile.id as string,
  }
}
