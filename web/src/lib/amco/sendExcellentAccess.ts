import { createAdminClient } from '@/lib/supabase/admin'
import { buildExcellentAccessEmail, EXCELLENT_SCHOOL_YEAR, type ExcellentChild } from './excellentEmail'

type AdminClient = ReturnType<typeof createAdminClient>

export interface ExcellentSendResult {
  dryRun: boolean
  pendingFamilies: number
  processed: number
  sent: number
  noEmail: number
  failed: number
  skippedUnmatched: number
  details: string[]
}

const PAUSE_MS = 600 // Resend permite ~2 correos por segundo

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Envía a cada familia el acceso de sus hijos a Excellent (Amco), un correo
 * por familia al tutor principal -- misma regla que los comunicados
 * urgentes (`notifyUrgentMessage`): el principal si tiene correo, si no el
 * primero con correo registrado.
 *
 * Solo se envía por estudiantes EMPAREJADOS (`student_id` no nulo), inscritos
 * y no borrados. Una fila sin emparejar nunca se le manda a nadie: adivinar
 * de quién es un correo de un menor es peor que no enviarlo.
 *
 * Idempotente: cada familia se reserva en `amco_access_dispatches` antes de
 * enviar, así que ejecutar esto varias veces (se programa en 3 horarios) o a
 * mano nunca duplica un correo.
 */
export async function sendExcellentAccess(params: {
  schoolId: string
  batch: number
  limit: number
  dryRun: boolean
}): Promise<ExcellentSendResult> {
  const { schoolId, batch, limit, dryRun } = params
  const admin: AdminClient = createAdminClient()
  const result: ExcellentSendResult = {
    dryRun, pendingFamilies: 0, processed: 0, sent: 0, noEmail: 0, failed: 0, skippedUnmatched: 0, details: [],
  }

  const { data: accounts, error: accountsError } = await admin
    .from('amco_student_accounts')
    .select('student_id, email')
    .eq('school_id', schoolId)
    .eq('school_year', EXCELLENT_SCHOOL_YEAR)
    .eq('batch', batch)
    .lte('send_after', new Date().toISOString())
  if (accountsError) throw new Error(`No se pudo leer amco_student_accounts: ${accountsError.message}`)

  const matched = (accounts ?? []).filter((a) => a.student_id)
  result.skippedUnmatched = (accounts ?? []).length - matched.length
  if (matched.length === 0) return result

  const studentIds = matched.map((a) => a.student_id as string)
  const [{ data: students, error: studentsError }, { data: school }] = await Promise.all([
    admin
      .from('students')
      .select('id, first_name, last_name, grade_level, family_id')
      .eq('school_id', schoolId)
      .eq('enrollment_status', 'inscrito')
      .is('deleted_at', null)
      .in('id', studentIds),
    admin.from('schools').select('name').eq('id', schoolId).single(),
  ])
  if (studentsError) throw new Error(`No se pudo leer students: ${studentsError.message}`)

  const emailByStudent = new Map(matched.map((a) => [a.student_id as string, a.email as string]))
  const childrenByFamily = new Map<string, ExcellentChild[]>()
  for (const s of students ?? []) {
    const amcoEmail = emailByStudent.get(s.id)
    if (!amcoEmail || !s.family_id) continue
    const list = childrenByFamily.get(s.family_id) ?? []
    list.push({ fullName: `${s.first_name} ${s.last_name}`.trim(), grade: s.grade_level ?? '', amcoEmail })
    childrenByFamily.set(s.family_id, list)
  }

  const familyIds = Array.from(childrenByFamily.keys())
  const { data: done } = await admin
    .from('amco_access_dispatches')
    .select('family_id')
    .eq('school_id', schoolId)
    .eq('school_year', EXCELLENT_SCHOOL_YEAR)
    .eq('batch', batch)
    .in('status', ['enviado', 'enviando'])
    .in('family_id', familyIds)
  const doneSet = new Set((done ?? []).map((d) => d.family_id as string))
  const pending = familyIds.filter((id) => !doneSet.has(id))
  result.pendingFamilies = pending.length

  const { data: guardians } = await admin
    .from('guardians')
    .select('family_id, email, is_primary')
    .eq('school_id', schoolId)
    .in('family_id', pending)
    .order('is_primary', { ascending: false })
  const emailByFamily = new Map<string, string>()
  for (const g of guardians ?? []) {
    if (g.email && !emailByFamily.has(g.family_id)) emailByFamily.set(g.family_id, g.email)
  }

  for (const familyId of pending.slice(0, limit)) {
    const recipient = emailByFamily.get(familyId) ?? null
    const children = childrenByFamily.get(familyId) ?? []
    result.processed += 1

    if (dryRun) {
      result.details.push(`${recipient ? 'enviaría' : 'SIN CORREO'} · familia ${familyId} · ${children.length} hijo(s)`)
      if (!recipient) result.noEmail += 1
      continue
    }

    if (!recipient) {
      await upsertDispatch(admin, { schoolId, familyId, batch, status: 'sin_correo', recipient: null, detail: 'Ningún tutor con correo registrado' })
      result.noEmail += 1
      continue
    }

    // Reserva: solo quien logra pasar la familia a 'enviando' la envía.
    const claimed = await claimFamily(admin, { schoolId, familyId, batch, recipient })
    if (!claimed) continue

    const { subject, body } = buildExcellentAccessEmail(children)
    const outcome = await invokeNotifyMessage(admin, { schoolName: school?.name ?? null, guardianEmail: recipient, subject, body })
    await admin
      .from('amco_access_dispatches')
      .update({ status: outcome.ok ? 'enviado' : 'error', detail: outcome.ok ? null : outcome.error, attempted_at: new Date().toISOString() })
      .eq('school_id', schoolId).eq('family_id', familyId).eq('school_year', EXCELLENT_SCHOOL_YEAR).eq('batch', batch)
    if (outcome.ok) result.sent += 1
    else {
      result.failed += 1
      result.details.push(`error · familia ${familyId}: ${outcome.error}`)
    }
    await sleep(PAUSE_MS)
  }

  return result
}

async function upsertDispatch(
  admin: AdminClient,
  p: { schoolId: string; familyId: string; batch: number; status: 'sin_correo' | 'error'; recipient: string | null; detail: string }
) {
  await admin.from('amco_access_dispatches').upsert(
    {
      school_id: p.schoolId, family_id: p.familyId, school_year: EXCELLENT_SCHOOL_YEAR, batch: p.batch,
      status: p.status, recipient: p.recipient, detail: p.detail, attempted_at: new Date().toISOString(),
    },
    { onConflict: 'school_id,family_id,school_year,batch' }
  )
}

/** true si esta corrida logró reservar la familia (nadie más la está enviando ni la envió). */
async function claimFamily(
  admin: AdminClient,
  p: { schoolId: string; familyId: string; batch: number; recipient: string }
): Promise<boolean> {
  const { data: inserted, error } = await admin
    .from('amco_access_dispatches')
    .insert({ school_id: p.schoolId, family_id: p.familyId, school_year: EXCELLENT_SCHOOL_YEAR, batch: p.batch, status: 'enviando', recipient: p.recipient })
    .select('id')
  if (!error && inserted && inserted.length > 0) return true

  // Ya había una fila (reintento de 'sin_correo'/'error'): solo se retoma si no está enviada.
  const { data: retaken } = await admin
    .from('amco_access_dispatches')
    .update({ status: 'enviando', recipient: p.recipient, detail: null, attempted_at: new Date().toISOString() })
    .eq('school_id', p.schoolId).eq('family_id', p.familyId).eq('school_year', EXCELLENT_SCHOOL_YEAR).eq('batch', p.batch)
    .in('status', ['sin_correo', 'error'])
    .select('id')
  return !!retaken && retaken.length > 0
}

/**
 * notify-message responde 200 aunque Resend falle (con success:false), así
 * que hay que mirar el cuerpo: si no, un correo que nunca salió quedaría
 * marcado como enviado.
 */
async function invokeNotifyMessage(
  admin: AdminClient,
  input: { schoolName: string | null; guardianEmail: string; subject: string; body: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { data, error } = await admin.functions.invoke('notify-message', { body: input })
    if (error) return { ok: false, error: error.message }
    const payload = data as { success?: boolean; channel?: string; error?: string } | null
    if (payload?.success && payload.channel === 'email') return { ok: true }
    return { ok: false, error: payload?.error ?? payload?.channel ?? 'Respuesta inesperada de notify-message' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
