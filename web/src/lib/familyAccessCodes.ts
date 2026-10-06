import { createHash, randomInt, randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { findAuthUserByEmail } from '@/lib/auth/findAuthUserByEmail'
import { normalizePhoneForMatch } from '@/lib/phone'
import { logFamilyAccessFailure } from '@/lib/familyAccessLog'

export const FAMILY_ACCESS_CODE_TTL_HOURS = 24
export const FAMILY_ACCESS_CODE_TTL_LABEL = '24 horas'
export const FAMILY_ACCESS_MAX_ATTEMPTS = 5
export const FAMILY_ACCESS_MAX_CODES_PER_15_MINUTES = 3
export { FAMILY_ACCESS_MAX_MANUAL_CODES_PER_DAY } from './familyAccessPolicy'

const PHONE_AUTH_DOMAIN = 'familias.mentoriapp.local'

type AdminClient = ReturnType<typeof createAdminClient>

export type GuardianMatch = {
  id: string
  school_id: string
  family_id: string
  first_name: string
  last_name: string
  phone: string | null
}

export function publicAccessError() {
  return 'No pudimos enviar el codigo. Verifica el numero o contacta a la secretaria del colegio.'
}

function codeSecret() {
  return process.env.FAMILY_ACCESS_CODE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'family-access-code-secret'
}

export function hashFamilyAccessCode(challengeId: string, code: string) {
  return createHash('sha256')
    .update(`${challengeId}:${code}:${codeSecret()}`)
    .digest('hex')
}

export function generateFamilyAccessCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

function phoneLoginEmail(schoolId: string, normalizedPhone: string) {
  return `${schoolId}-${normalizedPhone}@${PHONE_AUTH_DOMAIN}`.toLowerCase()
}

export async function findGuardianByPhone(
  admin: AdminClient,
  normalizedPhone: string,
  schoolId?: string
): Promise<GuardianMatch | null> {
  let query = admin
    .from('guardians')
    .select('id, school_id, family_id, first_name, last_name, phone')
    .is('deleted_at', null)

  if (schoolId) query = query.eq('school_id', schoolId)

  const { data: guardians, error } = await query
  if (error) throw error

  const matches = ((guardians ?? []) as GuardianMatch[]).filter(
    (guardian) => guardian.phone && normalizePhoneForMatch(guardian.phone) === normalizedPhone
  )

  // Si el mismo telefono aparece en mas de una ficha, no adivinamos. Es mejor
  // que secretaria lo confirme antes de entregar acceso.
  if (matches.length !== 1) return null
  return matches[0]
}

export async function ensureAuthForGuardian(
  admin: AdminClient,
  guardian: GuardianMatch,
  normalizedPhone: string
) {
  const { data: profiles, error: profilesError } = await admin
    .from('users_profiles')
    .select('auth_id, role, created_at')
    .eq('guardian_id', guardian.id)
    .order('role', { ascending: true })
    .order('created_at', { ascending: true })

  if (profilesError) {
    logFamilyAccessFailure('guardian-profiles', profilesError)
    throw profilesError
  }

  const existingProfile = (profiles ?? []).find((profile) => profile.role === 'guardian') ?? profiles?.[0]
  if (existingProfile?.auth_id) {
    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(existingProfile.auth_id)
    if (authError || !authUser.user?.email) {
      logFamilyAccessFailure('guardian-auth-account', authError)
      throw new Error('No se pudo revisar la cuenta de acceso familiar.')
    }
    return { authId: existingProfile.auth_id as string, authEmail: authUser.user.email }
  }

  const authEmail = phoneLoginEmail(guardian.school_id, normalizedPhone)
  let authUser = await findAuthUserByEmail(admin, authEmail)

  if (!authUser) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: authEmail,
      email_confirm: true,
      user_metadata: {
        full_name: `${guardian.first_name} ${guardian.last_name}`.trim(),
        phone: guardian.phone,
        access_channel: 'family_phone_code',
      },
    })
    if (createError || !created.user) {
      logFamilyAccessFailure('guardian-create-account', createError)
      throw createError ?? new Error('No se pudo crear la cuenta de acceso por telefono.')
    }
    authUser = created.user
  }

  const { error: profileError } = await admin.from('users_profiles').insert({
    auth_id: authUser.id,
    school_id: guardian.school_id,
    guardian_id: guardian.id,
    role: 'guardian',
  })

  if (profileError) {
    logFamilyAccessFailure('guardian-create-profile', profileError)
    throw profileError
  }
  return { authId: authUser.id, authEmail }
}

export async function guardianHasLinkedStudents(admin: AdminClient, guardianId: string) {
  const { count, error } = await admin
    .from('student_guardians')
    .select('student_id', { count: 'exact', head: true })
    .eq('guardian_id', guardianId)

  if (error) throw error
  return (count ?? 0) > 0
}

export async function createFamilyAccessChallenge(
  admin: AdminClient,
  guardian: GuardianMatch,
  normalizedPhone: string
) {
  const auth = await ensureAuthForGuardian(admin, guardian, normalizedPhone)
  const code = generateFamilyAccessCode()
  const challengeId = randomUUID()
  const expiresAt = new Date(Date.now() + FAMILY_ACCESS_CODE_TTL_HOURS * 60 * 60 * 1000).toISOString()

  const { data: challenge, error: challengeError } = await admin
    .from('family_phone_access_codes')
    .insert({
      id: challengeId,
      school_id: guardian.school_id,
      guardian_id: guardian.id,
      auth_id: auth.authId,
      auth_email: auth.authEmail,
      normalized_phone: normalizedPhone,
      code_hash: hashFamilyAccessCode(challengeId, code),
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (challengeError || !challenge?.id) {
    throw new Error(challengeError?.message ?? 'No pudimos preparar el codigo.')
  }

  return {
    challengeId: challenge.id as string,
    code,
    expiresAt,
    authId: auth.authId,
    authEmail: auth.authEmail,
  }
}
