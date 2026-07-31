'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'

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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

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

  // Con el cliente admin (service_role) a propósito: users_profiles no
  // tiene ninguna policy de INSERT (ver AGENTS.md) -- correcto, porque la
  // única vía de creación válida es esta, server-side, ya autorizada
  // arriba. Todo lo que antes bloqueaba RLS ahora se valida en este
  // Server Action (permiso del invitador, jerarquía de rol, school_id
  // resuelto en servidor, staff_id del mismo colegio).
  const { error: profileError } = await admin.from('users_profiles').insert({
    auth_id: authId,
    school_id: schoolId,
    staff_id: staffId,
    role: loginRole,
  })

  if (profileError) {
    console.error('[inviteStaffAccess] fallo el insert de perfil', { staffId, authId, schoolId, loginRole, error: profileError })

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
          after_state: { profile_error: profileError.message, delete_error: deleteError.message },
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
