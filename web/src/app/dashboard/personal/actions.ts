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

// Jerarquía para impedir que un payload manipulado (o un bug en la UI)
// le pida al servidor asignar un rol de más peso que el del propio
// invitador. super_admin no es un rol invitable desde aquí (no está en
// LOGIN_ROLES) pero se incluye para poder comparar contra el rol de
// quien invita.
const ROLE_RANK: Record<string, number> = {
  super_admin: 4,
  school_admin: 3,
  director: 3,
  teacher: 1,
  finance: 1,
  reception: 1,
}

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

  // El invitador nunca puede otorgar un rol de más peso que el suyo propio
  // -- se valida aquí, en el servidor, contra el rol ya resuelto de la
  // sesión (profile.role), nunca contra algo que venga del cliente.
  if ((ROLE_RANK[loginRole] ?? 0) > (ROLE_RANK[profile.role] ?? 0)) {
    return { ok: false, message: 'No puedes asignar un rol de acceso superior al tuyo.' }
  }

  // schoolId sale del perfil del invitador ya resuelto en el servidor --
  // nunca de un parámetro que venga del cliente (esta función no acepta uno).
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

  // Marca si la cuenta de Auth se creó en ESTA llamada -- es la única que
  // se puede revertir de forma segura si algo falla después. Si el correo
  // ya tenía cuenta (ej. ya es tutor en otro colegio) y se reusa, esa
  // cuenta es de otra persona/flujo y jamás debe tocarse ni borrarse aquí.
  const authAccountCreatedHere = Boolean(invited?.user?.id)

  // Si el correo ya tenía una cuenta de Auth, inviteUserByEmail falla --
  // se reusa esa cuenta en vez de tratarlo como error.
  if (inviteError || !authId) {
    const isAlreadyRegistered = inviteError?.message?.toLowerCase().includes('already been registered')
    if (!isAlreadyRegistered) {
      console.error('[inviteStaffAccess] fallo inviteUserByEmail', { staffId, email: staff.email, error: inviteError })
      return { ok: false, message: 'No se pudo enviar la invitación. Intenta de nuevo en unos minutos.' }
    }
    const { data: usersList } = await admin.auth.admin.listUsers()
    const existingUser = usersList?.users.find((u) => u.email?.toLowerCase() === staff.email.toLowerCase())
    if (!existingUser) {
      return { ok: false, message: 'Ese correo ya está registrado, pero no se pudo vincular. Contacta soporte.' }
    }
    authId = existingUser.id
  }

  // Vincular el perfil con el helper de doble rol: cubre el caso de quien
  // ya es tutor en el colegio y ahora entra tambien como staff.
  const linkResult = await linkProfileForDualRole(admin, authId, schoolId, { staffId, role: loginRole })
  if (!linkResult.ok) {
    console.error('[inviteStaffAccess] fallo el vinculo de perfil', { staffId, authId, schoolId, loginRole, error: linkResult.message })

    // Compensación, no transacción real: si la cuenta de Auth se creó
    // aquí mismo, se revierte para no dejar un usuario con credenciales
    // y sin perfil. Si la cuenta ya existía de antes, no se toca.
    if (authAccountCreatedHere) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(authId)

      if (deleteError) {
        // El rollback también falló: queda un usuario de Auth huérfano de
        // verdad. No se silencia -- se deja constancia explícita en
        // audit_logs (tabla ya existente, con RLS y lectura de solo
        // administradores) además del log de consola, para que sea
        // rastreable después de que este request termine.
        console.error('[inviteStaffAccess] fallo tambien el rollback (deleteUser) -- usuario de auth huerfano', {
          authId, staffId, schoolId, deleteError,
        })
        await admin.from('audit_logs').insert({
          school_id: schoolId,
          user_id: user.id,
          action: 'invite_rollback_failed',
          table_name: 'users_profiles',
          record_id: staffId,
          before_state: { auth_id: authId, staff_id: staffId, attempted_role: loginRole },
          after_state: { profile_error: linkResult.message, delete_error: deleteError.message },
        })
        return {
          ok: false,
          message: `No se pudo completar la invitación y quedó un usuario a medias. Contacta soporte con este id: ${authId}`,
        }
      }
    }

    return { ok: false, message: 'No se pudo completar la invitación. Intenta de nuevo.' }
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
  // Se devuelve también el rol de quien llama: hace falta para comparar
  // jerarquía antes de asignar un rol de acceso (ver ROLE_RANK).
  return { ok: true as const, schoolId, role: profile.role }
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

/**
 * Cambia el rol de acceso de alguien que YA tiene cuenta en el sistema --
 * ej. se le dio "Docente" por error cuando en realidad es recepción.
 * inviteStaffAccess solo cubre el momento de la invitación inicial; esto
 * cubre corregirlo después.
 */
export async function changeAccessRoleAction(profileId: string, newRole: string): Promise<InviteResult> {
  if (!LOGIN_ROLES.includes(newRole as LoginRole)) {
    return { ok: false, message: 'Rol de acceso inválido.' }
  }

  const resolved = await resolveStaffAdmin()
  if (!resolved.ok) return { ok: false, message: resolved.message }

  // Misma jerarquía que en inviteStaffAccess. Hoy no hay forma de escalar
  // por aquí (solo llegan roles de acceso total, y ninguno de los roles
  // asignables pesa más que ellos), pero el control iba en un solo camino
  // de los dos: si algún día se le da el módulo 'personal' a un rol de
  // menos peso -- como ya se amplió el de Recepción --, esto lo cubre.
  if ((ROLE_RANK[newRole] ?? 0) > (ROLE_RANK[resolved.role] ?? 0)) {
    return { ok: false, message: 'No puedes asignar un rol de acceso superior al tuyo.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('users_profiles')
    .update({ role: newRole })
    .eq('id', profileId)
    .eq('school_id', resolved.schoolId)
    .not('staff_id', 'is', null)
  if (error) return { ok: false, message: 'No se pudo cambiar el rol de acceso.' }

  revalidatePath('/dashboard/personal')
  return { ok: true, message: 'Rol de acceso actualizado.' }
}
