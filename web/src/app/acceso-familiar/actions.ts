'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getWhatsappConnection, sendWhatsappMessage } from '@/lib/whatsapp/connection'
import { maskPhone, normalizePhoneForMatch, phoneDigits, toWhatsAppNumber } from '@/lib/phone'
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
  } catch {
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
    console.error('[acceso-familiar] No se pudo enviar WhatsApp', error)
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

export async function verifyFamilyAccessCodeByPhone(rawPhone: string, code: string): Promise<VerifyCodeResult> {
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

