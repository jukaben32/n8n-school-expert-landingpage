'use server'

// OJO: un archivo 'use server' solo exporta funciones async -- ni
// constantes ni tipos (ver AGENTS.md). Las interfaces de abajo NO se
// exportan; las constantes viven en lib/payroll/labels.ts.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { parsePayslipPaste } from '@/lib/payroll/parsePayslipPaste'
import { suggestStaffId } from '@/lib/payroll/matchStaff'
import { composePayslipEmail } from '@/lib/payroll/payslipEmail'
import { isPayslipRun, periodLabel } from '@/lib/payroll/labels'
import { notifyStaffByEmail } from '@/lib/notifications/notifyStaffByEmail'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.educacionmanantial.com'

/**
 * Autorización de TODAS las acciones de este archivo: solo Dirección
 * (nomina_gestionar). Se usa siempre el cliente de SESIÓN, no el admin:
 * las policies de payslips son la segunda barrera, así que aunque este
 * chequeo tuviera un descuido la base de datos tampoco dejaría pasar a
 * nadie más.
 */
async function managerContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No hay sesión activa.' } as const
  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !canAccess(profile.role, 'nomina_gestionar')) {
    return { error: 'No tienes permiso para gestionar la nómina.' } as const
  }
  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { supabase, profile, schoolId } as const
}

interface PreviewPerson {
  excelId: string
  name: string
  staffId: string | null
  suggestedStaffId: string | null
}

interface PreviewResult {
  ok: boolean
  error?: string
  errors: string[]
  rowCount: number
  periods: { periodKey: number; run: string; label: string; count: number }[]
  people: PreviewPerson[]
  staff: { id: string; name: string }[]
  alreadyPublished: string[]
}

async function loadStaffAndMap(supabase: Awaited<ReturnType<typeof createClient>>, schoolId: string) {
  const [{ data: staffRaw, error: staffError }, { data: mapRaw, error: mapError }] = await Promise.all([
    supabase.from('staff').select('id, first_name, last_name').eq('school_id', schoolId).is('deleted_at', null),
    supabase.from('payslip_staff_map').select('excel_id, staff_id').eq('school_id', schoolId),
  ])
  const staff = (staffRaw ?? []).map((s) => ({ id: s.id as string, name: `${s.first_name} ${s.last_name}`.trim() }))
  const map = new Map((mapRaw ?? []).map((m) => [m.excel_id as string, m.staff_id as string]))
  return { staff, map, error: staffError?.message ?? mapError?.message ?? null }
}

/** Paso 1 de la carga: valida lo pegado y propone a quién corresponde cada ID. No guarda nada. */
export async function previewPayslipImportAction(text: string): Promise<PreviewResult> {
  const empty: PreviewResult = { ok: false, errors: [], rowCount: 0, periods: [], people: [], staff: [], alreadyPublished: [] }
  const ctx = await managerContext()
  if ('error' in ctx) return { ...empty, error: ctx.error }

  const parsed = parsePayslipPaste(text)
  if (parsed.rows.length === 0) return { ...empty, errors: parsed.errors, error: 'No hay filas válidas para cargar.' }

  const { staff, map, error } = await loadStaffAndMap(ctx.supabase, ctx.schoolId)
  if (error) return { ...empty, errors: parsed.errors, error: `No se pudo leer el personal. ${error}` }

  const people = new Map<string, PreviewPerson>()
  for (const r of parsed.rows) {
    if (people.has(r.excelId)) continue
    const mapped = map.get(r.excelId) ?? null
    people.set(r.excelId, {
      excelId: r.excelId,
      name: r.employeeName,
      staffId: mapped,
      suggestedStaffId: mapped ? null : suggestStaffId(r.employeeName, staff),
    })
  }

  const periods = new Map<string, { periodKey: number; run: string; label: string; count: number }>()
  for (const r of parsed.rows) {
    const k = `${r.periodKey}|${r.run}`
    const cur = periods.get(k) ?? { periodKey: r.periodKey, run: r.run, label: periodLabel(r.periodKey, r.run), count: 0 }
    cur.count += 1
    periods.set(k, cur)
  }

  // ¿Alguno de estos períodos ya tiene comprobantes PUBLICADOS? (no se pueden pisar)
  const keys = [...new Set(parsed.rows.map((r) => r.periodKey))]
  const { data: published } = await ctx.supabase
    .from('payslips')
    .select('period_key, run')
    .eq('school_id', ctx.schoolId)
    .in('period_key', keys)
    .not('published_at', 'is', null)
  const alreadyPublished = [...new Set((published ?? []).map((p) => periodLabel(p.period_key as number, p.run as 'M' | 'Q1' | 'Q2')))]

  return {
    ok: true,
    errors: parsed.errors,
    rowCount: parsed.rows.length,
    periods: [...periods.values()],
    people: [...people.values()],
    staff: staff.sort((a, b) => a.name.localeCompare(b.name, 'es')),
    alreadyPublished,
  }
}

interface ImportResult {
  ok: boolean
  error?: string
  saved?: number
  skipped?: string[]
}

/**
 * Paso 2: guarda como BORRADOR (nadie más que Dirección lo ve todavía).
 * Vuelve a leer y validar el texto en el servidor -- nunca confía en las
 * filas que mostró el navegador -- y verifica que cada persona elegida
 * sea de ESTE colegio.
 */
export async function importPayslipsAction(text: string, mapping: Record<string, string>): Promise<ImportResult> {
  const ctx = await managerContext()
  if ('error' in ctx) return { ok: false, error: ctx.error }

  const parsed = parsePayslipPaste(text)
  if (parsed.errors.length > 0) return { ok: false, error: 'Hay filas con errores. Corrija la hoja y vuelva a pegar.' }
  if (parsed.rows.length === 0) return { ok: false, error: 'No hay filas para cargar.' }

  const { staff, map, error } = await loadStaffAndMap(ctx.supabase, ctx.schoolId)
  if (error) return { ok: false, error: `No se pudo leer el personal. ${error}` }
  const validStaff = new Set(staff.map((s) => s.id))

  const resolved = new Map<string, string>()
  const newMappings: { school_id: string; excel_id: string; staff_id: string; created_by: string }[] = []
  for (const r of parsed.rows) {
    if (resolved.has(r.excelId)) continue
    const existing = map.get(r.excelId)
    const chosen = existing ?? mapping[r.excelId]
    if (!chosen) return { ok: false, error: `Falta elegir a qué empleado corresponde ${r.excelId} (${r.employeeName}).` }
    if (!validStaff.has(chosen)) return { ok: false, error: `El empleado elegido para ${r.excelId} no pertenece a este colegio.` }
    resolved.set(r.excelId, chosen)
    if (!existing) newMappings.push({ school_id: ctx.schoolId, excel_id: r.excelId, staff_id: chosen, created_by: ctx.profile.id })
  }
  // Dos IDs de Excel no pueden ser la misma persona en el mismo período.
  const seenStaff = new Set<string>()
  for (const r of parsed.rows) {
    const k = `${resolved.get(r.excelId)}|${r.periodKey}|${r.run}`
    if (seenStaff.has(k)) return { ok: false, error: `Dos filas de ${periodLabel(r.periodKey, r.run)} apuntan al mismo empleado (${r.excelId}).` }
    seenStaff.add(k)
  }

  // Lo ya PUBLICADO no se pisa.
  const { data: published, error: pubError } = await ctx.supabase
    .from('payslips')
    .select('staff_id, period_key, run')
    .eq('school_id', ctx.schoolId)
    .in('period_key', [...new Set(parsed.rows.map((r) => r.periodKey))])
    .not('published_at', 'is', null)
  if (pubError) return { ok: false, error: `No se pudo verificar lo ya publicado. ${pubError.message}` }
  const publishedKeys = new Set((published ?? []).map((p) => `${p.staff_id}|${p.period_key}|${p.run}`))

  const skipped: string[] = []
  const payload = parsed.rows.flatMap((r) => {
    const staffId = resolved.get(r.excelId) as string
    if (publishedKeys.has(`${staffId}|${r.periodKey}|${r.run}`)) {
      skipped.push(`${r.employeeName} (${periodLabel(r.periodKey, r.run)}): ya está publicado`)
      return []
    }
    return [{
      school_id: ctx.schoolId, staff_id: staffId, period_key: r.periodKey, run: r.run, employee_name: r.employeeName,
      payment_method: r.paymentMethod, base_salary: r.baseSalary, other_income: r.otherIncome, gross: r.gross,
      afp: r.afp, ars: r.ars, isr: r.isr, private_insurance: r.privateInsurance, tuition_discount: r.tuitionDiscount,
      savings_deposit: r.savingsDeposit, advances: r.advances, loan_installment: r.loanInstallment, cafeteria: r.cafeteria,
      uniforms: r.uniforms, other_deductions: r.otherDeductions, total_deductions: r.totalDeductions,
      savings_withdrawal: r.savingsWithdrawal, net: r.net, created_by: ctx.profile.id,
    }]
  })

  if (newMappings.length > 0) {
    const { error: mapError } = await ctx.supabase.from('payslip_staff_map').upsert(newMappings, { onConflict: 'school_id,excel_id' })
    if (mapError) return { ok: false, error: `No se pudo guardar el vínculo de empleados. ${mapError.message}` }
  }
  if (payload.length > 0) {
    const { error: upError } = await ctx.supabase.from('payslips').upsert(payload, { onConflict: 'school_id,staff_id,period_key,run' })
    if (upError) return { ok: false, error: `No se pudieron guardar los comprobantes. ${upError.message}` }
  }

  revalidatePath('/dashboard/nomina')
  return { ok: true, saved: payload.length, skipped }
}

interface SimpleResult {
  ok: boolean
  error?: string
  changed?: number
}

/** Publica (o retira) todos los comprobantes de un período/corrida. */
export async function setPeriodPublishedAction(periodKey: number, run: string, publish: boolean): Promise<SimpleResult> {
  const ctx = await managerContext()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!Number.isInteger(periodKey) || !isPayslipRun(run)) return { ok: false, error: 'Período inválido.' }

  const base = ctx.supabase.from('payslips')
  const query = publish
    ? base.update({ published_at: new Date().toISOString(), published_by: ctx.profile.id }).is('published_at', null)
    : base.update({ published_at: null, published_by: null }).not('published_at', 'is', null)
  // .select() a propósito: sin él, una policy que bloquea el update da 0 filas sin error.
  const { data, error } = await query
    .eq('school_id', ctx.schoolId).eq('period_key', periodKey).eq('run', run)
    .select('id')
  if (error) return { ok: false, error: `No se pudo actualizar. ${error.message}` }

  revalidatePath('/dashboard/nomina')
  revalidatePath(`/dashboard/nomina/${periodKey}/${run}`)
  return { ok: true, changed: data?.length ?? 0 }
}

interface NotifyBatchResult {
  ok: boolean
  error?: string
  sent: number
  failed: { name: string; reason: string }[]
  attemptedIds: string[]
  remaining: number
}

/**
 * Avisa por correo a los empleados con comprobante PUBLICADO y aún no
 * avisado. Procesa pocos por llamada (6) para no pasar el límite de tiempo
 * de una Server Action; el navegador la repite hasta que remaining sea 0,
 * pasando los ids ya intentados para no reintentar en bucle un correo que
 * falló. Solo marca notified_at lo que de verdad se envió.
 */
export async function notifyPeriodBatchAction(periodKey: number, run: string, alreadyAttempted: string[]): Promise<NotifyBatchResult> {
  const fail = (error: string): NotifyBatchResult => ({ ok: false, error, sent: 0, failed: [], attemptedIds: [], remaining: 0 })
  const ctx = await managerContext()
  if ('error' in ctx) return fail(ctx.error ?? 'No autorizado.')
  if (!Number.isInteger(periodKey) || !isPayslipRun(run)) return fail('Período inválido.')

  const { data: pendingRaw, error } = await ctx.supabase
    .from('payslips')
    .select('id, staff_id, employee_name')
    .eq('school_id', ctx.schoolId).eq('period_key', periodKey).eq('run', run)
    .not('published_at', 'is', null).is('notified_at', null)
  if (error) return fail(`No se pudo leer los comprobantes. ${error.message}`)

  const tried = new Set(alreadyAttempted)
  const pending = (pendingRaw ?? []).filter((p) => !tried.has(p.id as string))
  const batch = pending.slice(0, 6)
  if (batch.length === 0) return { ok: true, sent: 0, failed: [], attemptedIds: [], remaining: 0 }

  const [{ data: staffRows }, { data: school }] = await Promise.all([
    ctx.supabase.from('staff').select('id, first_name, email').in('id', batch.map((b) => b.staff_id as string)),
    ctx.supabase.from('schools').select('name').eq('id', ctx.schoolId).maybeSingle(),
  ])
  const staffById = new Map((staffRows ?? []).map((s) => [s.id as string, s]))

  let sent = 0
  const failed: { name: string; reason: string }[] = []
  for (const p of batch) {
    const s = staffById.get(p.staff_id as string)
    const name = p.employee_name as string
    if (!s) { failed.push({ name, reason: 'sin ficha de personal' }); continue }
    const mail = composePayslipEmail({
      firstName: (s.first_name as string) || name, label: periodLabel(periodKey, run), schoolName: school?.name ?? null, siteUrl: SITE_URL,
    })
    const res = await notifyStaffByEmail({ schoolName: school?.name ?? null, email: s.email as string, subject: mail.subject, body: mail.body })
    if (!res.ok) { failed.push({ name, reason: res.reason ?? 'no se pudo enviar' }); continue }
    const { data: marked, error: markError } = await ctx.supabase
      .from('payslips').update({ notified_at: new Date().toISOString() }).eq('id', p.id as string).select('id')
    if (markError || !marked || marked.length === 0) failed.push({ name, reason: 'se envió pero no se pudo marcar como avisado' })
    else sent += 1
  }

  revalidatePath(`/dashboard/nomina/${periodKey}/${run}`)
  return { ok: true, sent, failed, attemptedIds: batch.map((b) => b.id as string), remaining: pending.length - batch.length }
}
