'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { reconcileAlegraPayments } from '@/lib/accounting/reconcileAlegraPayments'
import { syncStudentCodesFromAlegra, learnStudentCode } from '@/lib/accounting/syncStudentCodes'
import { isStudentCode } from '@/lib/accounting/alegraStudentCodes'
import { applyPrepayDiscountCredit } from '@/lib/accounting/annualPrepayCredit'
import { alegraIsConfigured, fetchAlegraInvoiceDetail } from '@/lib/accounting/alegraClient'
import { cashierTuitionDiscountPercent, explicitPrepayDiscount } from '@/lib/accounting/alegraMatching'

/**
 * Bandeja de conciliación con Alegra.
 *
 * ⚠️ Este archivo lleva 'use server': NO puede exportar nada que no sea una
 * función async. Exportar una constante desde aquí ya tumbó una pantalla
 * entera en producción (ver AGENTS.md, 2026-09-03) -- el bundler la
 * convierte en una referencia de servidor y el componente cliente revienta
 * al montarse, sin que tsc/lint/build avisen.
 *
 * Todas las escrituras van con el cliente admin (service_role) porque las
 * tablas de conciliación no tienen policy de escritura a propósito: la
 * autorización se repite aquí en código, igual que `recordExternalPayment`.
 */

interface ActionResult {
  ok: boolean
  error?: string
}

async function resolveTesoreriaStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'tesoreria')) {
    return { ok: false as const, error: 'No tienes permiso para gestionar cuentas por cobrar.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, staffProfileId: profile.id as string, schoolId }
}

/**
 * Dispara una conciliación a mano, sin esperar a la corrida de las 7pm.
 * `sinceDate` (opcional, 'YYYY-MM-DD') vuelve a leer Alegra desde esa
 * fecha para recuperar cobros que quedaron fuera de la ventana de 30 días.
 */
export async function runAlegraSyncNow(sinceDate?: string): Promise<ActionResult & { resumen?: string }> {
  const staff = await resolveTesoreriaStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  let desde: string | undefined
  if (sinceDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sinceDate)) return { ok: false, error: 'Fecha inválida.' }
    const hoy = new Date().toISOString().slice(0, 10)
    if (sinceDate > hoy) return { ok: false, error: 'La fecha no puede ser futura.' }
    // Un año escolar hacia atrás como máximo: Alegra pagina de 30 en 30.
    const tope = new Date()
    tope.setFullYear(tope.getFullYear() - 1)
    if (sinceDate < tope.toISOString().slice(0, 10)) return { ok: false, error: 'Elige una fecha de hace menos de un año.' }
    desde = sinceDate
  }

  const result = await reconcileAlegraPayments({ schoolId: staff.schoolId, trigger: 'manual', sinceDate: desde })

  revalidatePath('/dashboard/tesoreria/alegra')
  revalidatePath('/dashboard/tesoreria/cuentas-por-cobrar')

  if (result.status === 'sin_credenciales') {
    return { ok: false, error: result.errorMessage ?? 'Alegra no está configurado en el servidor todavía.' }
  }
  if (result.status === 'error') {
    return { ok: false, error: result.errorMessage ?? 'La conciliación no se pudo completar.' }
  }
  return {
    ok: true,
    resumen: `${result.invoicesSeen} facturas revisadas · ${result.loadedCount} cobros registrados · ` +
      `${result.reviewCount} para revisar · ${result.skippedCount} ya estaban.`,
  }
}

/**
 * Atribuye (parte de) un cobro de Alegra a un estudiante y lo registra.
 *
 * Mismo camino que `recordExternalPayment`: factura con status 'pagado' y
 * `ncf`/`ncf_type` en null -- el comprobante fiscal real ya existe en
 * Alegra, emitir uno aquí sería un documento fantasma ante la DGII.
 *
 * El monto es editable porque un e-CF conjunto a nombre del tutor cubre a
 * varios hermanos (requisito fiscal, ver AGENTS.md): se resuelve una vez
 * por hijo hasta cubrir el total, y la fila solo se cierra cuando queda
 * cubierta entera.
 */
export async function resolveAlegraMatch(
  matchId: string,
  studentId: string,
  amount: number,
  note: string
): Promise<ActionResult> {
  const staff = await resolveTesoreriaStaff()
  if (!staff.ok) return { ok: false, error: staff.error }
  if (!studentId) return { ok: false, error: 'Elige a qué estudiante corresponde este cobro.' }
  if (!amount || amount <= 0) return { ok: false, error: 'Indica un monto mayor a cero.' }

  const admin = createAdminClient()

  const { data: match } = await admin
    .from('alegra_payment_matches')
    .select('id, school_id, status, amount, assigned_amount, alegra_invoice_id, alegra_number, alegra_date, alegra_note, alegra_payment_method, alegra_client_identification, alegra_client_id_type')
    .eq('id', matchId)
    .eq('school_id', staff.schoolId)
    .single()
  if (!match) return { ok: false, error: 'No se encontró ese cobro en la bandeja.' }
  if (match.status !== 'pendiente') return { ok: false, error: 'Ese cobro ya fue resuelto.' }

  const roundedAmount = Math.round(amount * 100) / 100
  const restante = Math.round((Number(match.amount) - Number(match.assigned_amount)) * 100) / 100
  if (roundedAmount > restante) {
    return { ok: false, error: `Solo quedan RD$${restante.toFixed(2)} por atribuir de este comprobante.` }
  }

  const { data: student } = await admin
    .from('students')
    .select('id, family_id')
    .eq('id', studentId)
    .eq('school_id', staff.schoolId)
    .is('deleted_at', null)
    .single()
  if (!student) return { ok: false, error: 'No se encontró el estudiante.' }

  // Protección contra cargar el cobro al hermano equivocado (caso real
  // 2026-09-15: el e-CF de Joandry, con su matrícula, se le cargó a su
  // hermana y Joandry apareció en mora y con el portal bloqueado). Si el
  // comprobante trae la matrícula de OTRO estudiante, se exige confirmarlo.
  const matriculaComprobante = match.alegra_client_id_type === 'IE' && isStudentCode(match.alegra_client_identification)
    ? String(match.alegra_client_identification).trim()
    : null
  if (matriculaComprobante && !/\bconfirmo\b/i.test(note)) {
    const { data: dueno } = await admin
      .from('students')
      .select('id, first_name, last_name')
      .eq('school_id', staff.schoolId)
      .eq('student_code', matriculaComprobante)
      .is('deleted_at', null)
      .maybeSingle()
    if (dueno && dueno.id !== student.id) {
      return {
        ok: false,
        error: `Este comprobante trae la matrícula ${matriculaComprobante}, que es de ${dueno.first_name} ${dueno.last_name}. ` +
          'Elige a ese estudiante. Si de verdad corresponde a otro, escribe "confirmo" en la nota.',
      }
    }
  }

  let { data: concept } = await admin
    .from('billing_concepts')
    .select('id')
    .eq('school_id', staff.schoolId)
    .eq('recurrence', 'monthly')
    .ilike('name', '%mensualidad%')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (!concept) {
    const { data: nuevo, error: conceptError } = await admin
      .from('billing_concepts')
      .insert({ school_id: staff.schoolId, name: 'Mensualidad', amount: roundedAmount, recurrence: 'monthly', applies_to: 'student' })
      .select('id')
      .single()
    if (conceptError) return { ok: false, error: 'No se pudo preparar el concepto de mensualidad.' }
    concept = nuevo
  }

  const etiqueta = [
    match.alegra_number ? `e-CF ${match.alegra_number}` : null,
    match.alegra_payment_method,
    match.alegra_note,
    note.trim() || null,
  ].filter(Boolean).join(' · ')

  const { data: invoice, error: invoiceError } = await admin.from('invoices').insert({
    school_id: staff.schoolId,
    family_id: student.family_id,
    student_id: student.id,
    concept_id: concept?.id ?? null,
    description: `Mensualidad — cobro ya registrado (Alegra (POS)): ${etiqueta}`,
    amount: roundedAmount,
    tax_amount: 0,
    total_amount: roundedAmount,
    due_date: match.alegra_date,
    status: 'pagado',
    paid_at: new Date(`${match.alegra_date}T00:00:00`).toISOString(),
    ncf: null,
    ncf_type: null,
    external_reference: match.alegra_number,
    created_by: staff.staffProfileId,
  }).select('id').single()

  if (invoiceError) {
    // El índice único de external_reference es la red de seguridad contra
    // registrar dos veces el mismo comprobante para el mismo estudiante.
    return { ok: false, error: `No se pudo registrar el cobro: ${invoiceError.message}` }
  }

  const { error: paymentError } = await admin.from('payments').insert({
    school_id: staff.schoolId,
    invoice_id: invoice.id,
    amount_paid: roundedAmount,
    payment_method: 'alegra',
    received_by: staff.staffProfileId,
    paid_at: new Date(`${match.alegra_date}T00:00:00`).toISOString(),
    notes: etiqueta || null,
  })
  if (paymentError) return { ok: false, error: `Se registró la factura pero no el pago: ${paymentError.message}` }

  // Descuento por pago adelantado dado en caja (ver annualPrepayCredit.ts).
  // Si el comprobante entero es de este estudiante, se lee en Alegra el
  // descuento que caja anotó en la línea; si se reparte entre hermanos, no
  // (el descuento es del comprobante completo, no de este hijo).
  let explicitDiscount = 0
  const comprobanteEntero = Math.abs(roundedAmount - Number(match.amount)) < 0.01 && Number(match.assigned_amount) === 0
  if (comprobanteEntero && match.alegra_invoice_id && alegraIsConfigured()) {
    try {
      const [detalle, { data: base }, { data: becaRow }] = await Promise.all([
        fetchAlegraInvoiceDetail(String(match.alegra_invoice_id)),
        admin.rpc('student_tuition_basis', { p_student_id: student.id }).maybeSingle(),
        admin.from('students').select('tuition_discount_percent').eq('id', student.id).maybeSingle(),
      ])
      const cuota = Number((base as { monthly_amount?: number } | null)?.monthly_amount ?? 0)
      const beca = Number(becaRow?.tuition_discount_percent ?? 0)
      explicitDiscount = explicitPrepayDiscount(detalle.items, cuota, beca)
      // Beca dada en caja: se anota para el aviso de Cuentas por Cobrar.
      const cuotaNivel = beca > 0 && beca < 100 ? cuota / (1 - beca / 100) : cuota
      const becaCaja = cashierTuitionDiscountPercent(detalle.items, cuotaNivel, match.alegra_note ?? null)
      if (becaCaja !== null) {
        await admin.from('invoices').update({ discount_percent: becaCaja }).eq('id', invoice.id)
      }
    } catch (e) {
      console.error('[resolveAlegraMatch] no se pudo leer el descuento en Alegra', e)
    }
  }
  await applyPrepayDiscountCredit(admin, {
    invoiceId: invoice.id, studentId: student.id,
    invoiceDate: match.alegra_date, invoiceAmount: roundedAmount, note: match.alegra_note,
    explicitDiscount,
  })

  // Aprende la matrícula: la próxima factura de este estudiante con esta
  // matrícula se emparejará sola, sin pasar por la bandeja.
  await learnStudentCode(staff.schoolId, student.id, match.alegra_client_id_type, match.alegra_client_identification)

  const asignado = Math.round((Number(match.assigned_amount) + roundedAmount) * 100) / 100
  const cubierto = asignado >= Number(match.amount) - 0.001

  await admin.from('alegra_payment_matches').update({
    assigned_amount: asignado,
    status: cubierto ? 'cargado' : 'pendiente',
    resolved_by: cubierto ? staff.staffProfileId : null,
    resolved_at: cubierto ? new Date().toISOString() : null,
    resolution_note: note.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', matchId)

  revalidatePath('/dashboard/tesoreria/alegra')
  revalidatePath('/dashboard/tesoreria/cuentas-por-cobrar')
  revalidatePath('/dashboard/tesoreria')
  return { ok: true }
}

/**
 * Descarta un cobro de la bandeja sin registrarlo -- para los que no
 * corresponden a mensualidad de ningún estudiante de la plataforma, o que
 * ya estaban cargados a mano desde antes. Nunca borra nada: la fila queda
 * con el motivo escrito, para que se pueda auditar después.
 */
export async function discardAlegraMatch(matchId: string, note: string): Promise<ActionResult> {
  const staff = await resolveTesoreriaStaff()
  if (!staff.ok) return { ok: false, error: staff.error }
  if (!note.trim()) return { ok: false, error: 'Escribe por qué se descarta este cobro.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('alegra_payment_matches')
    .update({
      status: 'descartado',
      resolved_by: staff.staffProfileId,
      resolved_at: new Date().toISOString(),
      resolution_note: note.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .eq('school_id', staff.schoolId)
    .eq('status', 'pendiente')
    .select('id')

  if (error) return { ok: false, error: `No se pudo descartar: ${error.message}` }
  if (!data || data.length === 0) return { ok: false, error: 'Ese cobro ya no está pendiente.' }

  revalidatePath('/dashboard/tesoreria/alegra')
  return { ok: true }
}

/**
 * Botón "Vincular matrículas": trae las matrículas de Alegra y las guarda
 * en las fichas donde el emparejamiento es seguro. Devuelve además las
 * sugerencias que hay que confirmar a mano. Nunca cambia un nombre.
 */
export async function linkAlegraStudentCodes(): Promise<ActionResult & {
  applied?: number
  alreadyLinked?: number
  unmatched?: number
  links?: { studentName: string; code: string; alegraName: string; level: string }[]
  suggestions?: { code: string; alegraName: string; candidates: { studentId: string; studentName: string }[] }[]
}> {
  const staff = await resolveTesoreriaStaff()
  if (!staff.ok) return { ok: false, error: staff.error }
  try {
    const r = await syncStudentCodesFromAlegra(staff.schoolId)
    if (r.errors.length > 0 && r.applied === 0 && r.links.length === 0 && r.suggestions.length === 0) {
      return { ok: false, error: r.errors.join(' · ') }
    }
    revalidatePath('/dashboard/tesoreria/alegra')
    return {
      ok: true,
      applied: r.applied,
      alreadyLinked: r.alreadyLinked,
      unmatched: r.unmatched,
      links: r.links.map((l) => ({ studentName: l.studentName, code: l.code, alegraName: l.alegraName, level: l.level })),
      suggestions: r.suggestions,
      error: r.errors.length > 0 ? r.errors.join(' · ') : undefined,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : JSON.stringify(e) }
  }
}

/** Confirma a mano una sugerencia: guarda esa matrícula en ese estudiante. */
export async function confirmStudentCode(studentId: string, code: string): Promise<ActionResult> {
  const staff = await resolveTesoreriaStaff()
  if (!staff.ok) return { ok: false, error: staff.error }
  const limpio = (code ?? '').trim()
  if (!isStudentCode(limpio)) return { ok: false, error: 'Matrícula con formato inválido.' }
  const admin = createAdminClient()
  const { data: enUso } = await admin.from('students')
    .select('id, first_name, last_name').eq('school_id', staff.schoolId).eq('student_code', limpio).is('deleted_at', null).limit(1)
  if (enUso && enUso.length > 0) {
    return { ok: false, error: `La matrícula ${limpio} ya la tiene ${enUso[0].first_name} ${enUso[0].last_name}.` }
  }
  const { data, error } = await admin.from('students')
    .update({ student_code: limpio })
    .eq('id', studentId).eq('school_id', staff.schoolId).is('deleted_at', null)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) return { ok: false, error: 'No se encontró el estudiante.' }
  revalidatePath('/dashboard/tesoreria/alegra')
  return { ok: true }
}
