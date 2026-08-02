'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'

interface InviteResult {
  ok: boolean
  message: string
}

/**
 * Invita a un tutor (padre/madre/tutor legal) a tener su propio acceso al
 * Portal Familiar. Mismo patrón exacto que inviteStaffAccess() en
 * dashboard/personal/actions.ts -- la única diferencia real es que el rol
 * de login siempre es 'guardian' (no hay que elegir uno, a diferencia del
 * personal, que puede ser docente/finanzas/recepción/etc).
 */
export async function inviteGuardianAccess(guardianId: string): Promise<InviteResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'familias')) {
    return { ok: false, message: 'No tienes permiso para invitar tutores.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const { data: guardian } = await supabase
    .from('guardians')
    .select('id, first_name, last_name, email, school_id')
    .eq('id', guardianId)
    .single()

  if (!guardian || guardian.school_id !== schoolId) {
    return { ok: false, message: 'No se encontró ese tutor en este colegio.' }
  }

  if (!guardian.email) {
    return { ok: false, message: 'Este tutor no tiene un correo registrado. Agrégalo primero en "Editar".' }
  }

  const { data: existingProfile } = await supabase
    .from('users_profiles')
    .select('id')
    .eq('guardian_id', guardianId)
    .maybeSingle()

  if (existingProfile) {
    return { ok: false, message: 'Este tutor ya tiene acceso al sistema.' }
  }

  const admin = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(guardian.email, {
    redirectTo: `${siteUrl}/actualizar-contrasena`,
    data: { full_name: `${guardian.first_name} ${guardian.last_name}` },
  })

  let authId = invited?.user?.id

  // Si el correo ya tenía una cuenta de Auth (ej. ya es personal del
  // colegio, o tutor de otro hijo en otro colegio), inviteUserByEmail
  // falla -- se reusa esa cuenta en vez de tratarlo como error.
  if (inviteError || !authId) {
    const isAlreadyRegistered = inviteError?.message?.toLowerCase().includes('already been registered')
    if (!isAlreadyRegistered) {
      return { ok: false, message: `No se pudo invitar: ${inviteError?.message ?? 'error desconocido'}` }
    }
    const { data: usersList } = await admin.auth.admin.listUsers()
    const existingUser = usersList?.users.find((u) => u.email?.toLowerCase() === guardian.email!.toLowerCase())
    if (!existingUser) {
      return { ok: false, message: 'Ese correo ya está registrado, pero no se pudo vincular. Contacta soporte.' }
    }
    authId = existingUser.id
  }

  const { error: profileError } = await supabase.from('users_profiles').insert({
    auth_id: authId,
    school_id: schoolId,
    guardian_id: guardianId,
    role: 'guardian',
  })

  if (profileError) {
    return { ok: false, message: `El correo se invitó, pero no se pudo vincular el perfil: ${profileError.message}` }
  }

  revalidatePath(`/dashboard/familias`)
  return { ok: true, message: `Invitación enviada a ${guardian.email}.` }
}
