'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSchool } from '@/lib/activeSchool'
import { normalizePhoneForMatch, maskPhone } from '@/lib/phone'
import { logFamilyAccessFailure } from '@/lib/familyAccessLog'
import {
  createFamilyAccessChallenge,
  FAMILY_ACCESS_CODE_TTL_LABEL,
  FAMILY_ACCESS_MAX_MANUAL_CODES_PER_DAY,
  guardianHasLinkedStudents,
  type GuardianMatch,
} from '@/lib/familyAccessCodes'

type ManualCodeResult =
  | {
      ok: true
      guardianName: string
      maskedPhone: string
      code: string
      expiresAt: string
      message: string
      remainingCodes: number
    }
  | { ok: false; message: string }

function accessUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  return `${siteUrl || 'https://n8n-school-expert-landingpage.vercel.app'}/acceso-familiar?modo=manual`
}

async function resolveOperator() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, message: 'No hay sesion activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  const allowedRoles = ['super_admin', 'school_admin', 'director', 'reception']
  if (!profile || !allowedRoles.includes(profile.role)) {
    return { ok: false as const, message: 'No tienes permiso para generar codigos familiares manuales.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, schoolId }
}

async function findGuardianMatches(schoolId: string, normalizedPhone: string): Promise<GuardianMatch[]> {
  const admin = createAdminClient()
  const { data: guardians, error } = await admin
    .from('guardians')
    .select('id, school_id, family_id, first_name, last_name, phone')
    .eq('school_id', schoolId)
    .is('deleted_at', null)

  if (error) throw error

  return ((guardians ?? []) as GuardianMatch[]).filter(
    (guardian) => guardian.phone && normalizePhoneForMatch(guardian.phone) === normalizedPhone
  )
}

export async function generateManualFamilyAccessCode(rawPhone: string): Promise<ManualCodeResult> {
  try {
    return await generateManualCode(rawPhone)
  } catch (error) {
    logFamilyAccessFailure('manual-generation', error)
    return { ok: false, message: 'No pudimos generar el codigo. Intenta de nuevo; si persiste, contacta soporte.' }
  }
}

async function generateManualCode(rawPhone: string): Promise<ManualCodeResult> {
  const operator = await resolveOperator()
  if (!operator.ok) return { ok: false, message: operator.message }

  const normalizedPhone = normalizePhoneForMatch(rawPhone)
  if (normalizedPhone.length !== 10) {
    return { ok: false, message: 'Escribe un numero de celular valido.' }
  }

  const admin = createAdminClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error: quotaError } = await admin
    .from('family_phone_access_codes')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', operator.schoolId)
    .gte('created_at', since)

  if (quotaError || count === null) {
    logFamilyAccessFailure('manual-quota', quotaError)
    return { ok: false, message: 'No pudimos consultar el cupo del colegio. Intenta de nuevo.' }
  }

  if ((count ?? 0) >= FAMILY_ACCESS_MAX_MANUAL_CODES_PER_DAY) {
    return {
      ok: false,
      message: `Ya se generaron ${FAMILY_ACCESS_MAX_MANUAL_CODES_PER_DAY} codigos en las ultimas 24 horas. El cupo se libera cuando los codigos anteriores cumplen 24 horas.`,
    }
  }

  const matches = await findGuardianMatches(operator.schoolId, normalizedPhone)
  if (matches.length === 0) {
    return { ok: false, message: 'No encontramos un tutor activo con ese celular en este colegio.' }
  }
  if (matches.length > 1) {
    return { ok: false, message: 'Ese celular aparece en mas de un tutor. Corrige la ficha antes de entregar acceso.' }
  }

  const guardian = matches[0]
  if (!(await guardianHasLinkedStudents(admin, guardian.id))) {
    return { ok: false, message: 'Ese tutor no tiene estudiantes vinculados. Revisa la ficha familiar antes de entregar acceso.' }
  }

  const { data: school } = await admin
    .from('schools')
    .select('name')
    .eq('id', guardian.school_id)
    .maybeSingle()

  try {
    const challenge = await createFamilyAccessChallenge(admin, guardian, normalizedPhone)
    const guardianName = `${guardian.first_name} ${guardian.last_name}`.trim()
    const schoolName = school?.name ?? 'el colegio'
    const message = [
      `Buen dia. Su codigo de acceso al Portal Familiar de ${schoolName} es: ${challenge.code}`,
      '',
      `Tiene tiempo limitado: vence en ${FAMILY_ACCESS_CODE_TTL_LABEL}. No lo comparta con nadie.`,
      '',
      'Entre aqui:',
      accessUrl(),
      '',
      'Escriba su celular registrado y el codigo. Si no aparece el campo del codigo, pulse "Ya tengo un codigo".',
    ].join('\n')

    return {
      ok: true,
      guardianName,
      maskedPhone: maskPhone(rawPhone),
      code: challenge.code,
      expiresAt: challenge.expiresAt,
      message,
      remainingCodes: Math.max(0, FAMILY_ACCESS_MAX_MANUAL_CODES_PER_DAY - count - 1),
    }
  } catch (error) {
    logFamilyAccessFailure('manual-challenge', error)
    return { ok: false, message: 'No pudimos generar el codigo. Intenta de nuevo.' }
  }
}
