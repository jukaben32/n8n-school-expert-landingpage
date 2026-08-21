'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { getPublicSiteUrl } from '@/lib/siteUrl'

interface InviteResult {
  ok: boolean
  message: string
  /** Presente solo cuando el tutor no tiene correo -- credenciales para
   * que el colegio se las entregue en persona (ver comentario de
   * createPhoneBasedAccess más abajo). */
  credentials?: { username: string; password: string }
}

const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789' // sin 0/O/1/l/I, para que se pueda copiar a mano sin confundirse

function generateTempPassword(): string {
  let pw = ''
  for (let i = 0; i < 10; i++) pw += TEMP_PASSWORD_CHARS[Math.floor(Math.random() * TEMP_PASSWORD_CHARS.length)]
  return pw
}

interface GuardianRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  school_id: string
}

/**
 * Invita a un tutor (padre/madre/tutor legal) a tener su propio acceso al
 * Portal Familiar.
 *
 * Con correo: mismo patrón que inviteStaffAccess() -- admin.inviteUserByEmail
 * manda un correo real con enlace para poner contraseña.
 *
 * SIN correo (común en RD -- muchos padres tienen celular/WhatsApp pero no
 * usan correo): no existe ningún flujo de invitación por correo que
 * funcione aquí. En vez de bloquear el acceso, se crea la cuenta
 * directamente con un usuario basado en el teléfono
 * (`{telefono}@mentoriapp.local`, un dominio que nunca se usa para enviar
 * nada -- solo como identificador) y una contraseña temporal generada al
 * momento. Como la inscripción ya es presencial, el colegio entrega esas
 * credenciales en papel ahí mismo, en vez de depender de un correo que el
 * padre quizás ni revisa. El padre puede cambiar su contraseña después
 * desde dentro del sistema si quiere.
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
    .select('id, first_name, last_name, email, phone, school_id')
    .eq('id', guardianId)
    .single()

  if (!guardian || (guardian as GuardianRow).school_id !== schoolId) {
    return { ok: false, message: 'No se encontró ese tutor en este colegio.' }
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

  if (guardian.email) {
    return inviteByEmail(admin, guardian as GuardianRow, schoolId)
  }
  return createPhoneBasedAccess(admin, guardian as GuardianRow, schoolId)
}

async function inviteByEmail(
  admin: ReturnType<typeof createAdminClient>,
  guardian: GuardianRow,
  schoolId: string
): Promise<InviteResult> {
  const siteUrl = getPublicSiteUrl()
  if (!siteUrl) {
    return { ok: false, message: 'Falta configurar NEXT_PUBLIC_SITE_URL en produccion.' }
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(guardian.email!, {
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

  const { error: profileError } = await admin.from('users_profiles').insert({
    auth_id: authId, school_id: schoolId, guardian_id: guardian.id, role: 'guardian',
  })
  if (profileError) {
    return { ok: false, message: `El correo se invitó, pero no se pudo vincular el perfil: ${profileError.message}` }
  }

  revalidatePath('/dashboard/familias')
  revalidatePath('/dashboard/estudiantes/escaneos')
  return { ok: true, message: `Invitación enviada a ${guardian.email}.` }
}

async function createPhoneBasedAccess(
  admin: ReturnType<typeof createAdminClient>,
  guardian: GuardianRow,
  schoolId: string
): Promise<InviteResult> {
  const normalizedPhone = (guardian.phone ?? '').replace(/\D/g, '')
  if (!normalizedPhone) {
    return { ok: false, message: 'Este tutor no tiene teléfono ni correo registrado -- no se puede crear acceso.' }
  }

  const pseudoEmail = `${normalizedPhone}@mentoriapp.local`
  const tempPassword = generateTempPassword()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: pseudoEmail,
    password: tempPassword,
    email_confirm: true, // no hay correo real que confirmar -- entra directo con estas credenciales
    user_metadata: { full_name: `${guardian.first_name} ${guardian.last_name}`, phone: guardian.phone },
  })

  let authId = created?.user?.id

  if (createError || !authId) {
    const isAlreadyRegistered = createError?.message?.toLowerCase().includes('already been registered')
    if (!isAlreadyRegistered) {
      return { ok: false, message: `No se pudo crear el acceso: ${createError?.message ?? 'error desconocido'}` }
    }
    // Ya existe una cuenta con este teléfono (ej. otro hijo con la misma
    // madre ya tiene acceso creado así) -- se reusa la cuenta, pero se le
    // asigna una contraseña nueva para poder mostrarla de nuevo (la
    // original nunca quedó guardada en ningún lado, ni debía).
    const { data: usersList } = await admin.auth.admin.listUsers()
    const existingUser = usersList?.users.find((u) => u.email?.toLowerCase() === pseudoEmail)
    if (!existingUser) {
      return { ok: false, message: 'Ya existe una cuenta con este teléfono, pero no se pudo vincular. Contacta soporte.' }
    }
    const { error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, { password: tempPassword })
    if (updateError) {
      return { ok: false, message: `No se pudo restablecer el acceso existente: ${updateError.message}` }
    }
    authId = existingUser.id
  }

  const { error: profileError } = await admin.from('users_profiles').insert({
    auth_id: authId, school_id: schoolId, guardian_id: guardian.id, role: 'guardian',
  })
  if (profileError) {
    return { ok: false, message: `Se creó el acceso, pero no se pudo vincular el perfil: ${profileError.message}` }
  }

  revalidatePath('/dashboard/familias')
  revalidatePath('/dashboard/estudiantes/escaneos')
  return {
    ok: true,
    message: 'Acceso creado. Entrégale estas credenciales al padre en persona.',
    credentials: { username: pseudoEmail, password: tempPassword },
  }
}
