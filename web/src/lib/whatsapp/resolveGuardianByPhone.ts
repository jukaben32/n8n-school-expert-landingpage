import { createAdminClient } from '@/lib/supabase/admin'

export type GuardianByPhoneResult =
  | { ok: true; familyId: string; guardianId: string; guardianName: string }
  | { ok: false; error: string }

// Same purpose as resolveGuardianIdentity.ts (auth/resolveGuardianIdentity.ts)
// but for the WhatsApp channel, which has no Supabase session/JWT to read —
// the only identity signal is the sender's phone number, scoped to the one
// school this webhook URL already identifies (see
// /api/whatsapp/webhook/[schoolId]).
//
// Phone matching is normalized (digits only, last 10) rather than exact —
// guardians.phone is free-text entered by school staff (+1 809-555-1234,
// 8095551234, 1-809-555-1234 all describe the same number), and WhatsApp's
// remoteJid arrives as a bare digit string with the country code attached.
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.slice(-10)
}

export async function resolveGuardianByPhone(schoolId: string, rawPhone: string): Promise<GuardianByPhoneResult> {
  const normalized = normalizePhone(rawPhone)
  if (normalized.length < 7) {
    return { ok: false, error: 'Número de teléfono inválido.' }
  }

  const admin = createAdminClient()
  const { data: guardians, error } = await admin
    .from('guardians')
    .select('id, family_id, first_name, last_name, phone')
    .eq('school_id', schoolId)
    .is('deleted_at', null)

  if (error) {
    return { ok: false, error: 'No se pudo verificar el número de teléfono.' }
  }

  const match = (guardians ?? []).find((g) => g.phone && normalizePhone(g.phone) === normalized)
  if (!match) {
    return {
      ok: false,
      error:
        'No encontramos este número asociado a ninguna familia del colegio. Contacta a la secretaría para vincular tu WhatsApp.',
    }
  }

  return {
    ok: true,
    familyId: match.family_id,
    guardianId: match.id,
    guardianName: `${match.first_name} ${match.last_name}`.trim(),
  }
}
