'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { getPublicSiteUrl } from '@/lib/siteUrl'

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
  let reusedExistingAccount = false

  // Si el correo ya tenía una cuenta de Auth (ej. ya es tutor en otro
  // colegio), inviteUserByEmail falla -- se reusa esa cuenta en vez de
  // tratarlo como error. BUG real corregido: este caso nunca mandaba
  // ningún correo (inviteUserByEmail falló, así que no salió nada), pero
  // el mensaje final siempre decía "Invitación enviada" de todos modos --
  // la persona quedaba vinculada sin ninguna forma de enterarse o entrar.
  // Ahora se le manda un correo de restablecer contraseña como sustituto.
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
    reusedExistingAccount = true
  }

  // users_profiles no tiene ninguna policy de RLS para insert (solo
  // select/update) -- insertar con el cliente de sesión del director/admin
  // siempre falla con "new row violates row-level security policy",
  // sin importar el rol. Se usa el cliente admin (service_role) porque el
  // permiso ya se validó arriba con canAccess().
  const { error: profileError } = await admin.from('users_profiles').insert({
    auth_id: authId,
    school_id: schoolId,
    staff_id: staffId,
    role: loginRole,
  })

  if (profileError) {
    return { ok: false, message: `El correo se invitó, pero no se pudo vincular el perfil: ${profileError.message}` }
  }

  revalidatePath('/dashboard/personal')

  if (!reusedExistingAccount) {
    return { ok: true, message: `Invitación enviada a ${staff.email}.` }
  }

  const { error: resetError } = await admin.auth.resetPasswordForEmail(staff.email, {
    redirectTo: `${siteUrl}/actualizar-contrasena`,
  })
  if (resetError) {
    return {
      ok: true,
      message: `Se vinculó el acceso, pero no se pudo enviar el correo (${resetError.message}). Pídele que entre con "Olvidé mi contraseña" en ${staff.email}.`,
    }
  }
  return { ok: true, message: `Ese correo ya tenía una cuenta -- se vinculó y le enviamos un correo a ${staff.email} para entrar.` }
}
