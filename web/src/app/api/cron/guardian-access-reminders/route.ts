import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicSiteUrl } from '@/lib/siteUrl'

/**
 * Seguimiento automático de acceso familiar.
 *
 * Reenvía enlaces de contraseña a tutores que YA tienen perfil de acceso,
 * correo real y todavía no han iniciado sesión. No crea usuarios, no crea
 * perfiles y no cambia roles. Cuando detecta `last_sign_in_at`, deja de
 * insistir y marca el caso como regularizado.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type GuardianRow = {
  id: string
  school_id: string
  family_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

type FamilyRow = { id: string }
type ProfileRow = { id: string; guardian_id: string; auth_id: string; created_at: string }
type ReminderRow = {
  guardian_id: string
  reminder_count: number
  last_sent_at: string | null
  stopped_at: string | null
  stop_reason: StopReason | null
}

type StopReason = 'regularizado' | 'max_intentos' | 'auth_no_existe' | 'correo_no_coincide'

type Summary = {
  dryRun: boolean
  checked: number
  eligible: number
  sent: number
  regularized: number
  skippedNoAccess: number
  skippedNoEmail: number
  skippedNotDue: number
  stoppedMaxAttempts: number
  stoppedAuthMissing: number
  stoppedEmailMismatch: number
  errors: number
}

const HOUR = 60 * 60 * 1000

function secretIsValid(header: string | null): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const provided = (header ?? '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

function hasRealEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email)
  return normalized !== '' && !normalized.endsWith('@mentoriapp.local')
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function isDue(profileCreatedAt: string, reminder: ReminderRow | undefined, now: number): boolean {
  const firstDelayHours = readPositiveInt(process.env.GUARDIAN_ACCESS_FIRST_REMINDER_HOURS, 24)
  const resendDelayHours = readPositiveInt(process.env.GUARDIAN_ACCESS_RESEND_HOURS, 48)

  if (!reminder?.last_sent_at) {
    return now - new Date(profileCreatedAt).getTime() >= firstDelayHours * HOUR
  }

  return now - new Date(reminder.last_sent_at).getTime() >= resendDelayHours * HOUR
}

function clampLimit(request: NextRequest): number {
  const fromQuery = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '', 10)
  if (!Number.isFinite(fromQuery) || fromQuery <= 0) return 100
  return Math.min(fromQuery, 200)
}

async function recordStop(
  admin: ReturnType<typeof createAdminClient>,
  guardian: GuardianRow,
  reminder: ReminderRow | undefined,
  reason: StopReason,
  dryRun: boolean,
  lastError: string | null = null
) {
  if (dryRun) return
  await admin.from('guardian_access_reminders').upsert({
    school_id: guardian.school_id,
    guardian_id: guardian.id,
    reminder_count: reminder?.reminder_count ?? 0,
    last_sent_at: reminder?.last_sent_at ?? null,
    stopped_at: new Date().toISOString(),
    stop_reason: reason,
    last_error: lastError,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'guardian_id' })
}

async function recordSent(
  admin: ReturnType<typeof createAdminClient>,
  guardian: GuardianRow,
  reminder: ReminderRow | undefined,
  dryRun: boolean
) {
  if (dryRun) return
  await admin.from('guardian_access_reminders').upsert({
    school_id: guardian.school_id,
    guardian_id: guardian.id,
    reminder_count: (reminder?.reminder_count ?? 0) + 1,
    last_sent_at: new Date().toISOString(),
    stopped_at: null,
    stop_reason: null,
    last_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'guardian_id' })
}

async function syncPseudoEmailIfNeeded(
  admin: ReturnType<typeof createAdminClient>,
  authId: string,
  currentAuthEmail: string,
  guardianEmail: string,
  dryRun: boolean
): Promise<{ ok: true } | { ok: false; reason: StopReason; error: string }> {
  if (currentAuthEmail === guardianEmail) return { ok: true }

  if (!currentAuthEmail.endsWith('@mentoriapp.local')) {
    return { ok: false, reason: 'correo_no_coincide', error: 'El correo de Auth no coincide con el correo de la ficha.' }
  }

  if (dryRun) return { ok: true }

  const { error } = await admin.auth.admin.updateUserById(authId, {
    email: guardianEmail,
    email_confirm: true,
  })

  if (error) {
    const reason = error.message?.toLowerCase().includes('already been registered') ? 'correo_no_coincide' : 'auth_no_existe'
    return { ok: false, reason, error: error.message }
  }

  return { ok: true }
}

async function run(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET no está configurada en el servidor.' }, { status: 503 })
  }
  if (!secretIsValid(request.headers.get('authorization'))) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
  }

  const siteUrl = getPublicSiteUrl()
  if (!siteUrl) {
    return NextResponse.json({ ok: false, error: 'Falta configurar NEXT_PUBLIC_SITE_URL en produccion.' }, { status: 503 })
  }

  const dryRun = request.nextUrl.searchParams.get('dry_run') === '1'
  const maxAttempts = readPositiveInt(process.env.GUARDIAN_ACCESS_MAX_REMINDERS, 3)
  const limit = clampLimit(request)
  const now = Date.now()
  const admin = createAdminClient()

  const summary: Summary = {
    dryRun,
    checked: 0,
    eligible: 0,
    sent: 0,
    regularized: 0,
    skippedNoAccess: 0,
    skippedNoEmail: 0,
    skippedNotDue: 0,
    stoppedMaxAttempts: 0,
    stoppedAuthMissing: 0,
    stoppedEmailMismatch: 0,
    errors: 0,
  }

  const { data: guardiansRaw, error: guardiansError } = await admin
    .from('guardians')
    .select('id, school_id, family_id, first_name, last_name, email')
    .is('deleted_at', null)

  if (guardiansError) return NextResponse.json({ ok: false, error: guardiansError.message }, { status: 500 })

  const guardians = ((guardiansRaw ?? []) as GuardianRow[]).filter((guardian) => hasRealEmail(guardian.email))
  summary.skippedNoEmail = (guardiansRaw ?? []).length - guardians.length

  if (guardians.length === 0) return NextResponse.json({ ok: true, ...summary })

  const familyIds = [...new Set(guardians.map((guardian) => guardian.family_id))]
  const { data: familiesRaw, error: familiesError } = await admin
    .from('families')
    .select('id')
    .in('id', familyIds)
    .is('deleted_at', null)

  if (familiesError) return NextResponse.json({ ok: false, error: familiesError.message }, { status: 500 })

  const activeFamilyIds = new Set(((familiesRaw ?? []) as FamilyRow[]).map((family) => family.id))
  const activeGuardians = guardians.filter((guardian) => activeFamilyIds.has(guardian.family_id))
  const guardianIds = activeGuardians.map((guardian) => guardian.id)
  if (guardianIds.length === 0) return NextResponse.json({ ok: true, ...summary })

  const [{ data: profilesRaw, error: profilesError }, { data: remindersRaw, error: remindersError }] = await Promise.all([
    admin.from('users_profiles').select('id, guardian_id, auth_id, created_at').in('guardian_id', guardianIds),
    admin.from('guardian_access_reminders').select('guardian_id, reminder_count, last_sent_at, stopped_at, stop_reason').in('guardian_id', guardianIds),
  ])

  if (profilesError) return NextResponse.json({ ok: false, error: profilesError.message }, { status: 500 })
  if (remindersError) return NextResponse.json({ ok: false, error: remindersError.message }, { status: 500 })

  const profilesByGuardian = new Map<string, ProfileRow>()
  for (const profile of (profilesRaw ?? []) as ProfileRow[]) {
    if (!profilesByGuardian.has(profile.guardian_id)) profilesByGuardian.set(profile.guardian_id, profile)
  }
  const remindersByGuardian = new Map(((remindersRaw ?? []) as ReminderRow[]).map((reminder) => [reminder.guardian_id, reminder]))

  for (const guardian of activeGuardians) {
    summary.checked++
    if (summary.sent >= limit) break

    const guardianEmail = normalizeEmail(guardian.email)
    const profile = profilesByGuardian.get(guardian.id)
    if (!profile?.auth_id) {
      summary.skippedNoAccess++
      continue
    }

    const reminder = remindersByGuardian.get(guardian.id)
    if (reminder?.stopped_at) {
      summary.skippedNotDue++
      continue
    }

    summary.eligible++

    const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(profile.auth_id)
    if (authUserError || !authUserData.user) {
      summary.stoppedAuthMissing++
      await recordStop(admin, guardian, reminder, 'auth_no_existe', dryRun, authUserError?.message ?? 'No existe la cuenta Auth vinculada.')
      continue
    }

    const authEmail = normalizeEmail(authUserData.user.email)
    if (authUserData.user.last_sign_in_at && authEmail === guardianEmail) {
      summary.regularized++
      await recordStop(admin, guardian, reminder, 'regularizado', dryRun)
      continue
    }

    if ((reminder?.reminder_count ?? 0) >= maxAttempts) {
      summary.stoppedMaxAttempts++
      await recordStop(admin, guardian, reminder, 'max_intentos', dryRun)
      continue
    }

    if (!isDue(profile.created_at, reminder, now)) {
      summary.skippedNotDue++
      continue
    }

    const syncResult = await syncPseudoEmailIfNeeded(admin, profile.auth_id, authEmail, guardianEmail, dryRun)
    if (!syncResult.ok) {
      if (syncResult.reason === 'correo_no_coincide') summary.stoppedEmailMismatch++
      if (syncResult.reason === 'auth_no_existe') summary.stoppedAuthMissing++
      await recordStop(admin, guardian, reminder, syncResult.reason, dryRun, syncResult.error)
      continue
    }

    if (!dryRun) {
      const { error: resetError } = await admin.auth.resetPasswordForEmail(guardianEmail, {
        redirectTo: `${siteUrl}/actualizar-contrasena`,
      })
      if (resetError) {
        summary.errors++
        await recordStop(admin, guardian, reminder, 'auth_no_existe', dryRun, resetError.message)
        continue
      }
    }

    summary.sent++
    await recordSent(admin, guardian, reminder, dryRun)
  }

  return NextResponse.json({ ok: summary.errors === 0, ...summary, limit, maxAttempts })
}

export async function POST(request: NextRequest) {
  return run(request)
}

export async function GET(request: NextRequest) {
  return run(request)
}
