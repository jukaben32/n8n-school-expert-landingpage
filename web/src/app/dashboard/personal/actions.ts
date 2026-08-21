'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { getPublicSiteUrl } from '@/lib/siteUrl'
import { linkProfileForDualRole } from '@/lib/auth/linkProfileForDualRole'

const LOGIN_ROLES = ['school_admin', 'director', 'teacher', 'finance', 'reception'] as const
type LoginRole = (typeof LOGIN_ROLES)[number]

interface InviteResult {
  ok: boolean
  message: string
}

/**
 * Invita a un miembro del personal a tener su propio acceso al sistema.
 * Crea el usuario de Auth (o reutiliza uno ya existente con ese correo),
 * le manda el correo de invitación de Supabase, y crea su fila en
 * users_profiles vinculada al colegio, rol y ficha de staff correctos.
 *
 * Solo quien puede gestionar Personal (director/school_admin/super_admin)
 * puede invitar -- se revalida en el servidor, no solo en la UI.
 */
export async function inviteStaffAccess(staffId: string, loginRole: string): Promise<InviteResult> {
  if (!LOGIN_ROLES.includes(loginRole as LoginRole)) {
    return { ok: false, message: 'Rol de acceso inválido.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'personal')) {
    return { ok: false, message: 'No tienes permiso para invitar personal.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const { data: staff } = await supabase
    .from('staff')
    .select('id, first_name, last_name, email, school_id')
    .eq('id', staffId)
    .single()

  if (!staff || staff.school_id !== schoolId) {
    return { ok: false, message: 'No se encontró ese miembro del personal en este colegio.' }
  }

  const { data: existingProfile } = await supabase
    .from('users_profiles')
    .select('id')
    .eq('staff_id', staffId)
    .maybeSingle()

  if (existingProfile) {
    return { ok: false, message: 'Esta persona ya tiene acceso al sistema.' }
  }

  const admin = createAdminClient()
  const siteUrl = getPublicSiteUrl()
  if (!siteUrl) {
    return { ok: false, message: 'Falta configurar NEXT_PUBLIC_SITE_URL en produccion.' }
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(staff.email, {
    redirectTo: `${siteUrl}/actualizar-contrasena`,
    data: { full_name: `${staff.first_name} ${staff.last_name}` },
  })

  let authId = invited?.user?.id

  // Si el correo ya tenía una cuenta de Auth (ej. ya es tutor en otro
  // colegio), inviteUserByEmail falla -- se reusa esa cuenta en vez de
  // tratarlo como error.
  if (inviteError || !authId) {
    const isAlreadyRegistered = inviteError?.message?.toLowerCase().includes('already been registered')
    if (!isAlreadyRegistered) {
      return { ok: false, message: `No se pudo invitar: ${inviteError?.message ?? 'error desconocido'}` }
    }
    const { data: usersList } = await admin.auth.admin.listUsers()
    const existingUser = usersList?.users.find((u) => u.email?.toLowerCase() === staff.email.toLowerCase())
    if (!existingUser) {
      return { ok: false, message: 'Ese correo ya está registrado, pero no se pudo vincular. Contacta soporte.' }
    }
    authId = existingUser.id
  }

  const linkResult = await linkProfileForDualRole(admin, authId, schoolId, { staffId, role: loginRole })
  if (!linkResult.ok) {
    return { ok: false, message: `El correo se invitó, pero no se pudo vincular el perfil: ${linkResult.message}` }
  }

  revalidatePath('/dashboard/personal')
  return { ok: true, message: `Invitación enviada a ${staff.email}.` }
}

export interface UpdateStaffInput {
  staffId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  role: string
  specialty: string
  educationLevel: string
  degreeTitle: string
  almaMater: string
}

async function resolveStaffAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, message: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'personal')) {
    return { ok: false as const, message: 'No tienes permiso para gestionar personal.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, schoolId }
}

export async function updateStaffAction(input: UpdateStaffInput): Promise<InviteResult> {
  const resolved = await resolveStaffAdmin()
  if (!resolved.ok) return { ok: false, message: resolved.message }

  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const email = input.email.trim()
  if (!firstName || !lastName || !email) {
    return { ok: false, message: 'Nombre, apellido y correo son obligatorios.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('staff')
    .update({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: input.phone.trim() || null,
      role: input.role,
      specialty: input.specialty.trim() || null,
      education_level: input.educationLevel || null,
      degree_title: input.degreeTitle.trim() || null,
      alma_mater: input.almaMater.trim() || null,
    })
    .eq('id', input.staffId)
    .eq('school_id', resolved.schoolId)
  if (error) return { ok: false, message: 'No se pudo actualizar el personal.' }

  revalidatePath('/dashboard/personal')
  return { ok: true, message: 'Actualizado.' }
}

/**
 * Elimina (soft-delete) una ficha de personal -- ej. alguien que renunció,
 * o un registro duplicado por error.
 *
 * Si esa persona tenía acceso al sistema (users_profiles con este
 * staff_id):
 * - Si TAMBIÉN es tutor de un hijo aquí (doble rol, guardian_id seteado):
 *   se le quita el staff_id y el rol pasa a 'guardian' -- conserva su
 *   acceso de familia, pierde el de personal. Nunca se le borra la
 *   cuenta de alguien que sigue siendo padre/madre en el colegio.
 * - Si NO es tutor: se borra su perfil y su cuenta de Auth por completo
 *   -- ya no debe poder entrar al sistema.
 */
export async function deleteStaffAction(staffId: string): Promise<InviteResult> {
  const resolved = await resolveStaffAdmin()
  if (!resolved.ok) return { ok: false, message: resolved.message }

  const admin = createAdminClient()

  const { data: linkedProfile } = await admin
    .from('users_profiles')
    .select('id, auth_id, guardian_id')
    .eq('staff_id', staffId)
    .eq('school_id', resolved.schoolId)
    .maybeSingle()

  if (linkedProfile) {
    if (linkedProfile.guardian_id) {
      await admin.from('users_profiles').update({ staff_id: null, role: 'guardian' }).eq('id', linkedProfile.id)
    } else {
      await admin.from('users_profiles').delete().eq('id', linkedProfile.id)
      await admin.auth.admin.deleteUser(linkedProfile.auth_id).catch(() => {
        // Si ya no existe en Auth por alguna razón, no bloquear el borrado del personal.
      })
    }
  }

  const { error } = await admin
    .from('staff')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', staffId)
    .eq('school_id', resolved.schoolId)
  if (error) return { ok: false, message: 'No se pudo eliminar el personal.' }

  revalidatePath('/dashboard/personal')
  return { ok: true, message: 'Eliminado.' }
}
