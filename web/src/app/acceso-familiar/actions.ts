'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getWhatsappConnection, sendWhatsappMessage } from '@/lib/whatsapp/connection'
import { maskPhone, normalizePhoneForMatch, phoneDigits, toWhatsAppNumber } from '@/lib/phone'
import { logFamilyAccessFailure } from '@/lib/familyAccessLog'
import {
  createFamilyAccessChallenge,
  FAMILY_ACCESS_CODE_TTL_LABEL,
  FAMILY_ACCESS_MAX_ATTEMPTS,
  FAMILY_ACCESS_MAX_CODES_PER_15_MINUTES,
  findGuardianByPhone,
  guardianHasLinkedStudents,
  hashFamilyAccessCode,
  publicAccessError,
} from '@/lib/familyAccessCodes'

type RequestCodeResult =
  | { ok: true; challengeId: string; message: string; maskedPhone: string }
  | { ok: false; message: string }

type VerifyCodeResult =
  | { ok: true; tokenHash: string }
  | { ok: false; message: string }

export async function requestFamilyAccessCode(rawPhone: string): Promise<RequestCodeResult> {
  try {
    return await requestCode(rawPhone)
  } catch (error) {
    logFamilyAccessFailure('automatic-request', error)
    return { ok: false, message: 'No pudimos preparar el codigo. Intenta de nuevo o contacta secretaria.' }
  }
}

async function requestCode(rawPhone: string): Promise<RequestCodeResult> {
  const normalizedPhone = normalizePhoneForMatch(rawPhone)
  if (normalizedPhone.length !== 10) {
    return { ok: false, message: 'Escribe un numero de celular valido.' }
  }

  const admin = createAdminClient()
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { count, error: quotaError } = await admin
    .from('family_phone_access_codes')
    .select('id', { count: 'exact', head: true })
    .eq('normalized_phone', normalizedPhone)
    .gte('created_at', since)

  if (quotaError || count === null) {
    logFamilyAccessFailure('automatic-quota', quotaError)
    return { ok: false, message: 'No pudimos consultar los intentos. Intenta de nuevo.' }
  }

  if ((count ?? 0) >= FAMILY_ACCESS_MAX_CODES_PER_15_MINUTES) {
    return { ok: false, message: 'Se enviaron varios codigos seguidos. Espera unos minutos y vuelve a intentar.' }
  }

  const guardian = await findGuardianByPhone(admin, normalizedPhone)
  if (!guardian) return { ok: false, message: publicAccessError() }

  if (!(await guardianHasLinkedStudents(admin, guardian.id))) return { ok: false, message: publicAccessError() }

  const { data: school } = await admin
    .from('schools')
    .select('name')
    .eq('id', guardian.school_id)
    .maybeSingle()

  const connection = await getWhatsappConnection(admin, guardian.school_id)
  if (!connection || !connection.is_enabled || connection.status !== 'connected') {
    return { ok: false, message: 'El WhatsApp del colegio todavia no esta disponible para enviar codigos.' }
  }

  let challenge: { challengeId: string; code: string }
  try {
    challenge = await createFamilyAccessChallenge(admin, guardian, normalizedPhone)
  } catch (error) {
    logFamilyAccessFailure('automatic-challenge', error)
    return { ok: false, message: 'No pudimos preparar el codigo. Intenta de nuevo.' }
  }

  const schoolName = school?.name ?? 'tu colegio'
  const message = [
    `Tu codigo de acceso al Portal Familiar de ${schoolName} es: ${challenge.code}`,
    '',
    `Tiene tiempo limitado: vence en ${FAMILY_ACCESS_CODE_TTL_LABEL}. No lo compartas con nadie.`,
  ].join('\n')

  try {
    await sendWhatsappMessage(connection, toWhatsAppNumber(phoneDigits(rawPhone)), message)
  } catch (error) {
    logFamilyAccessFailure('whatsapp-send', error)
    return { ok: false, message: 'No pudimos enviar el codigo por WhatsApp. Intenta mas tarde o contacta secretaria.' }
  }

  return {
    ok: true,
    challengeId: challenge.challengeId,
    maskedPhone: maskPhone(rawPhone),
    message: `Enviamos un codigo por WhatsApp al numero ${maskPhone(rawPhone)}. Tiene tiempo limitado: vence en ${FAMILY_ACCESS_CODE_TTL_LABEL}.`,
  }
}

export async function verifyFamilyAccessCode(challengeId: string, code: string): Promise<VerifyCodeResult> {
  try {
    return await verifyCode(challengeId, code)
  } catch (error) {
    logFamilyAccessFailure('verify-code', error)
    return { ok: false, message: 'No pudimos verificar el codigo. Intenta de nuevo.' }
  }
}

async function verifyCode(challengeId: string, code: string): Promise<VerifyCodeResult> {
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

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    return { ok: false, message: 'Ese codigo vencio. Pide uno nuevo.' }
  }

  if ((challenge.attempt_count ?? 0) >= FAMILY_ACCESS_MAX_ATTEMPTS) {
    return { ok: false, message: 'Ese codigo fue intentado muchas veces. Pide uno nuevo.' }
  }

  const expectedHash = hashFamilyAccessCode(challenge.id, cleanCode)
  if (expectedHash !== challenge.code_hash) {
    await admin
      .from('family_phone_access_codes')
      .update({ attempt_count: (challenge.attempt_count ?? 0) + 1 })
      .eq('id', challenge.id)
    return { ok: false, message: 'Codigo incorrecto. Revisa WhatsApp e intenta de nuevo.' }
  }

  // Reserve atomically so concurrent requests cannot mint two sessions.
  // Release this reservation if Auth fails, keeping the same code retryable.
  const consumedAt = new Date().toISOString()
  const { data: claimed, error: claimError } = await admin
    .from('family_phone_access_codes')
    .update({ consumed_at: consumedAt })
    .eq('id', challenge.id)
    .is('consumed_at', null)
    .eq('attempt_count', challenge.attempt_count ?? 0)
    .gt('expires_at', consumedAt)
    .select('id')
    .maybeSingle()

  if (claimError || !claimed) {
    if (claimError) logFamilyAccessFailure('claim-code', claimError)
    return { ok: false, message: 'No pudimos validar ese codigo. Intenta de nuevo; si ya fue usado, pide otro.' }
  }

  try {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: challenge.auth_email,
    })

    const tokenHash = linkData?.properties?.hashed_token
    if (linkError || !tokenHash) throw linkError ?? new Error('Missing auth token')

    return { ok: true, tokenHash }
  } catch (error) {
    logFamilyAccessFailure('prepare-session', error)
    const { error: releaseError } = await admin
      .from('family_phone_access_codes')
      .update({ consumed_at: null })
      .eq('id', challenge.id)
      .eq('consumed_at', consumedAt)
    if (releaseError) {
      logFamilyAccessFailure('release-code', releaseError)
      return { ok: false, message: 'No pudimos iniciar la sesion. Contacta secretaria para obtener otro codigo.' }
    }
    return { ok: false, message: 'No pudimos iniciar la sesion. Puedes intentar de nuevo con el mismo codigo.' }
  }
}

export async function verifyFamilyAccessCodeByPhone(rawPhone: string, code: string): Promise<VerifyCodeResult> {
  try {
    return await verifyCodeByPhone(rawPhone, code)
  } catch (error) {
    logFamilyAccessFailure('verify-by-phone', error)
    return { ok: false, message: 'No pudimos verificar el codigo. Intenta de nuevo.' }
  }
}

async function verifyCodeByPhone(rawPhone: string, code: string): Promise<VerifyCodeResult> {
  const normalizedPhone = normalizePhoneForMatch(rawPhone)
  const cleanCode = code.replace(/\D/g, '')
  if (normalizedPhone.length !== 10 || cleanCode.length !== 6) {
    return { ok: false, message: 'Escribe el celular y el codigo de 6 digitos.' }
  }

  const admin = createAdminClient()
  const { data: challenges, error } = await admin
    .from('family_phone_access_codes')
    .select('id, auth_email, code_hash, attempt_count, expires_at, consumed_at, created_at')
    .eq('normalized_phone', normalizedPhone)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(5)

  if (error || !challenges || challenges.length === 0) {
    return { ok: false, message: 'Ese codigo ya no esta disponible. Pide uno nuevo.' }
  }

  for (const challenge of challenges) {
    if ((challenge.attempt_count ?? 0) >= FAMILY_ACCESS_MAX_ATTEMPTS) continue
    const expectedHash = hashFamilyAccessCode(challenge.id, cleanCode)
    if (expectedHash === challenge.code_hash) {
      return verifyFamilyAccessCode(challenge.id, cleanCode)
    }
  }

  const latest = challenges[0]
  await admin
    .from('family_phone_access_codes')
    .update({ attempt_count: (latest.attempt_count ?? 0) + 1 })
    .eq('id', latest.id)

  return { ok: false, message: 'Codigo incorrecto. Revisa WhatsApp e intenta de nuevo.' }
}

