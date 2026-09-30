'use server'

import { createHash, randomInt } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { findAuthUserByEmail } from '@/lib/auth/findAuthUserByEmail'
import { getWhatsappConnection, sendWhatsappMessage } from '@/lib/whatsapp/connection'
import { maskPhone, normalizePhoneForMatch, phoneDigits, toWhatsAppNumber } from '@/lib/phone'

type RequestCodeResult =
  | { ok: true; challengeId: string; message: string; maskedPhone: string }
  | { ok: false; message: string }

type VerifyCodeResult =
  | { ok: true; tokenHash: string }
  | { ok: false; message: string }

type GuardianMatch = {
  id: string
  school_id: string
  family_id: string
  first_name: string
  last_name: string
  phone: string | null
}

const CODE_TTL_HOURS = 24
const CODE_TTL_LABEL = '24 horas'
const MAX_ATTEMPTS = 5
const MAX_CODES_PER_15_MINUTES = 3
const PHONE_AUTH_DOMAIN = 'familias.mentoriapp.local'

function publicAccessError() {
  return 'No pudimos enviar el codigo. Verifica el numero o contacta a la secretaria del colegio.'
}

function codeSecret() {
  return process.env.FAMILY_ACCESS_CODE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'family-access-code-secret'
}

function hashCode(challengeId: string, code: string) {
  return createHash('sha256')
    .update(`${challengeId}:${code}:${codeSecret()}`)
    .digest('hex')
}

function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

function phoneLoginEmail(schoolId: string, normalizedPhone: string) {
  return `${schoolId}-${normalizedPhone}@${PHONE_AUTH_DOMAIN}`.toLowerCase()
}

async function findGuardianByPhone(normalizedPhone: string): Promise<GuardianMatch | null> {
  const admin = createAdminClient()
  const { data: guardians, error } = await admin
    .from('guardians')
    .select('id, school_id, family_id, first_name, last_name, phone')
    .is('deleted_at', null)

  if (error) throw error

  const matches = ((guardians ?? []) as GuardianMatch[]).filter(
    (guardian) => guardian.phone && normalizePhoneForMatch(guardian.phone) === normalizedPhone
  )

  // Si el mismo telefono aparece en mas de una ficha, no adivinamos. Es mejor
  // que secretaria lo confirme antes de entregar acceso.
  if (matches.length !== 1) return null
  return matches[0]
}

async function ensureAuthForGuardian(guardian: GuardianMatch, normalizedPhone: string) {
  const admin = createAdminClient()

  const { data: profiles, error: profilesError } = await admin
    .from('users_profiles')
    .select('auth_id, role, created_at')
    .eq('guardian_id', guardian.id)
    .order('role', { ascending: true })
    .order('created_at', { ascending: true })

  if (profilesError) throw profilesError

  const existingProfile = (profiles ?? []).find((profile) => profile.role === 'guardian') ?? profiles?.[0]
  if (existingProfile?.auth_id) {
    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(existingProfile.auth_id)
    if (authError || !authUser.user?.email) {
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
      throw new Error(createError?.message ?? 'No se pudo crear la cuenta de acceso por telefono.')
    }
    authUser = created.user
  }

  const { error: profileError } = await admin.from('users_profiles').insert({
    auth_id: authUser.id,
    school_id: guardian.school_id,
    guardian_id: guardian.id,
    role: 'guardian',
  })

  if (profileError) throw profileError
  return { authId: authUser.id, authEmail }
}

export async function requestFamilyAccessCode(rawPhone: string): Promise<RequestCodeResult> {
  const normalizedPhone = normalizePhoneForMatch(rawPhone)
  if (normalizedPhone.length !== 10) {
    return { ok: false, message: 'Escribe un numero de celular valido.' }
  }

  const admin = createAdminClient()
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('family_phone_access_codes')
    .select('id', { count: 'exact', head: true })
    .eq('normalized_phone', normalizedPhone)
    .gte('created_at', since)

  if ((count ?? 0) >= MAX_CODES_PER_15_MINUTES) {
    return { ok: false, message: 'Se enviaron varios codigos seguidos. Espera unos minutos y vuelve a intentar.' }
  }

  const guardian = await findGuardianByPhone(normalizedPhone)
  if (!guardian) return { ok: false, message: publicAccessError() }

  const { count: linkedStudentsCount } = await admin
    .from('student_guardians')
    .select('student_id', { count: 'exact', head: true })
    .eq('guardian_id', guardian.id)

  if (!linkedStudentsCount) return { ok: false, message: publicAccessError() }

  const { data: school } = await admin
    .from('schools')
    .select('name')
    .eq('id', guardian.school_id)
    .maybeSingle()

  const connection = await getWhatsappConnection(admin, guardian.school_id)
  if (!connection || !connection.is_enabled || connection.status !== 'connected') {
    return { ok: false, message: 'El WhatsApp del colegio todavia no esta disponible para enviar codigos.' }
  }

  const auth = await ensureAuthForGuardian(guardian, normalizedPhone)
  const code = generateCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_HOURS * 60 * 60 * 1000).toISOString()

  const { data: challenge, error: challengeError } = await admin
    .from('family_phone_access_codes')
    .insert({
      school_id: guardian.school_id,
      guardian_id: guardian.id,
      auth_id: auth.authId,
      auth_email: auth.authEmail,
      normalized_phone: normalizedPhone,
      code_hash: 'pending',
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (challengeError || !challenge?.id) {
    return { ok: false, message: 'No pudimos preparar el codigo. Intenta de nuevo.' }
  }

  const { error: hashError } = await admin
    .from('family_phone_access_codes')
    .update({ code_hash: hashCode(challenge.id, code) })
    .eq('id', challenge.id)

  if (hashError) return { ok: false, message: 'No pudimos preparar el codigo. Intenta de nuevo.' }

  const schoolName = school?.name ?? 'tu colegio'
  const message = [
    `Tu codigo de acceso al Portal Familiar de ${schoolName} es: ${code}`,
    '',
    `Tiene tiempo limitado: vence en ${CODE_TTL_LABEL}. No lo compartas con nadie.`,
  ].join('\n')

  try {
    await sendWhatsappMessage(connection, toWhatsAppNumber(phoneDigits(rawPhone)), message)
  } catch (error) {
    console.error('[acceso-familiar] No se pudo enviar WhatsApp', error)
    return { ok: false, message: 'No pudimos enviar el codigo por WhatsApp. Intenta mas tarde o contacta secretaria.' }
  }

  return {
    ok: true,
    challengeId: challenge.id,
    maskedPhone: maskPhone(rawPhone),
    message: `Enviamos un codigo por WhatsApp al numero ${maskPhone(rawPhone)}. Tiene tiempo limitado: vence en ${CODE_TTL_LABEL}.`,
  }
}

export async function verifyFamilyAccessCode(challengeId: string, code: string): Promise<VerifyCodeResult> {
  const cleanCode = code.replace(/\D/g, '')
  if (!challengeId || cleanCode.length !== 6) {
    return { ok: false, message: 'Escribe el codigo de 6 digitos.' }
  }

  const admin = createAdminClient()
  const { data: challenge, error } = await admin
    .from('family_phone_access_codes')
    .select('id, auth_email, code_hash, attempt_count, expires_at, consumed_at')
    .eq('id', challengeId)
    .maybeSingle()

  if (error || !challenge || challenge.consumed_at) {
    return { ok: false, message: 'Ese codigo ya no esta disponible. Pide uno nuevo.' }
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return { ok: false, message: 'Ese codigo vencio. Pide uno nuevo.' }
  }

  if ((challenge.attempt_count ?? 0) >= MAX_ATTEMPTS) {
    return { ok: false, message: 'Ese codigo fue intentado muchas veces. Pide uno nuevo.' }
  }

  const expectedHash = hashCode(challenge.id, cleanCode)
  if (expectedHash !== challenge.code_hash) {
    await admin
      .from('family_phone_access_codes')
      .update({ attempt_count: (challenge.attempt_count ?? 0) + 1 })
      .eq('id', challenge.id)
    return { ok: false, message: 'Codigo incorrecto. Revisa WhatsApp e intenta de nuevo.' }
  }

  await admin
    .from('family_phone_access_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', challenge.id)

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: challenge.auth_email,
  })

  const tokenHash = linkData.properties?.hashed_token
  if (linkError || !tokenHash) {
    return { ok: false, message: 'No pudimos iniciar la sesion. Intenta de nuevo.' }
  }

  return { ok: true, tokenHash }
}

