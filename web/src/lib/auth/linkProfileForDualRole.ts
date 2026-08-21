import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

interface LinkResult {
  ok: boolean
  message?: string
}

/**
 * Vincula un auth_id a una ficha de personal o de tutor, permitiendo
 * doble rol (ej. un profesor que también es padre de un estudiante aquí).
 *
 * `users_profiles` tiene UNIQUE(auth_id) -- un solo login, un solo perfil.
 * Antes, invitar a alguien como tutor cuando su correo ya era personal
 * (o viceversa) intentaba un INSERT de una segunda fila y fallaba contra
 * esa restricción. Este helper primero busca si ya existe un perfil para
 * ese auth_id: si existe, actualiza esa misma fila para agregar el nuevo
 * vínculo (staff_id o guardian_id) en vez de chocar contra el UNIQUE; si
 * no existe, crea el perfil normal.
 *
 * El rol principal (`role`, el que controla canAccess()/menús) se decide
 * así: al agregar acceso de personal, el rol pasa a ser el de personal
 * (es su identidad de trabajo principal); al agregar acceso de tutor
 * sobre un perfil que ya es personal, el rol NO cambia -- sigue siendo
 * su rol de trabajo, y ve a sus hijos desde "Vista de Familia"
 * (resolveGuardianIdentity ya autoriza por guardian_id, no por role).
 */
export async function linkProfileForDualRole(
  admin: AdminClient,
  authId: string,
  schoolId: string,
  fields: { staffId: string; role: string } | { guardianId: string }
): Promise<LinkResult> {
  const { data: existing } = await admin
    .from('users_profiles')
    .select('id, school_id, staff_id, guardian_id')
    .eq('auth_id', authId)
    .maybeSingle()

  if (!existing) {
    const { error } = 'staffId' in fields
      ? await admin.from('users_profiles').insert({ auth_id: authId, school_id: schoolId, staff_id: fields.staffId, role: fields.role })
      : await admin.from('users_profiles').insert({ auth_id: authId, school_id: schoolId, guardian_id: fields.guardianId, role: 'guardian' })
    if (error) return { ok: false, message: error.message }
    return { ok: true }
  }

  if (existing.school_id !== schoolId) {
    return { ok: false, message: 'Este correo ya tiene una cuenta en otro colegio -- no se puede vincular aquí.' }
  }

  if ('staffId' in fields) {
    if (existing.staff_id && existing.staff_id !== fields.staffId) {
      return { ok: false, message: 'Este correo ya está vinculado a otra ficha de personal.' }
    }
    const { error } = await admin.from('users_profiles').update({ staff_id: fields.staffId, role: fields.role }).eq('id', existing.id)
    if (error) return { ok: false, message: error.message }
    return { ok: true }
  }

  if (existing.guardian_id && existing.guardian_id !== fields.guardianId) {
    return { ok: false, message: 'Este correo ya está vinculado a otra ficha de tutor.' }
  }
  const { error } = await admin.from('users_profiles').update({ guardian_id: fields.guardianId }).eq('id', existing.id)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}
