'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { notifyGuardianByEmail } from '@/lib/notifications/notifyGuardianByEmail'
import { EXTERNAL_PAYMENT_SOURCE_LABELS } from '@/lib/receivables/externalPaymentSources'

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
 * Avisa por correo al tutor principal de la familia sobre una cuota
 * vencida, invitándolo a pagar antes de que se le aplique el recargo por
 * mora -- no aplica ningún cargo, es solo el recordatorio.
 */
export async function sendOverdueReminder(studentId: string): Promise<ActionResult> {
  const staff = await resolveTesoreriaStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const admin = createAdminClient()

  const { data: student } = await admin
    .from('students')
    .select('id, first_name, last_name, family_id, school_id')
    .eq('id', studentId)
    .eq('school_id', staff.schoolId)
    .single()
  if (!student) return { ok: false, error: 'No se encontró el estudiante.' }

  const [{ data: receivable }, { data: school }, { data: guardians }] = await Promise.all([
    admin.rpc('calculate_receivable_breakdown', { p_student_id: studentId }).single(),
    admin.from('schools').select('name').eq('id', staff.schoolId).single(),
    admin.from('guardians').select('email, is_primary').eq('family_id', student.family_id).order('is_primary', { ascending: false }),
  ])

  const status = receivable as {
    overdue_amount: number | null
    late_fee_amount: number | null
    current_amount: number | null
    overdue_principal_amount: number | null
    total_due_amount: number | null
    oldest_overdue_due_date: string | null
    aging_bucket: string | null
  } | null

  if (!status || !status.oldest_overdue_due_date || status.aging_bucket === 'corriente' || status.aging_bucket === 'sin_configurar' ||
      !status.overdue_principal_amount || status.overdue_principal_amount <= 0) {
    return { ok: false, error: 'Este estudiante no tiene una cuota vencida que avisar.' }
  }

  const recipient = (guardians ?? []).find((g) => g.email)
  if (!recipient?.email) return { ok: false, error: 'La familia no tiene un correo registrado.' }

  const formatDOP = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' })
  const dueDateLabel = new Date(`${status.oldest_overdue_due_date}T00:00:00`).toLocaleDateString('es-DO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // El recargo es escalonado por días de atraso (manual de familia, sección
  // 9) -- ya no un único porcentaje plano, así que el aviso menciona el
  // monto de recargo ya calculado para HOY en vez de un "%" genérico que
  // dejó de representar la política real.
  const lateFeeNote = (status.late_fee_amount ?? 0) > 0
    ? ` El recargo de la cuota vencida es ${formatDOP.format(status.late_fee_amount ?? 0)}.`
    : ' Puedes ponerte al día ahora para evitar que se aplique el recargo por mora.'
  const currentNote = (status.current_amount ?? 0) > 0
    ? ` Además, tiene ${formatDOP.format(status.current_amount ?? 0)} como saldo corriente.`
    : ''

  await notifyGuardianByEmail({
    schoolName: school?.name ?? null,
    guardianEmail: recipient.email,
    subject: `Aviso de mensualidad pendiente — ${student.first_name} ${student.last_name}`,
    body: `La mensualidad de ${student.first_name} ${student.last_name} vence desde el ${dueDateLabel} ` +
      `y sigue pendiente (${formatDOP.format(status.overdue_principal_amount ?? 0)}).${lateFeeNote}${currentNote}`,
  })

  return { ok: true }
}

/**
 * Compatibilidad para clientes viejos: el botón manual se retiró porque el
 * recargo se calcula por cuota y se registra solo cuando se registra el pago.
 */
export async function generateLateFeeCharge(studentId: string): Promise<ActionResult> {
  void studentId
  return {
    ok: false,
    error: 'El recargo ya se calcula automáticamente por cuota. No hace falta generarlo manualmente.',
  }
}

/**
 * Registra un cobro que ya ocurrió fuera de esta plataforma (Alegra POS, u
 * otra plataforma) -- mientras los pagos en línea todavía no están
 * habilitados aquí, este es el único lugar para que Cuentas por Cobrar
 * refleje la realidad. A propósito NUNCA genera NCF (`ncf` queda null):
 * el comprobante fiscal real ya existe en el sistema donde se cobró
 * (Alegra u otro) -- generar uno aquí sería un documento fantasma que no
 * corresponde a ningún cobro real ante la DGII. Esto es puramente un
 * registro interno para que la deuda implícita deje de contar ese dinero
 * como pendiente. La mensualidad y el recargo se guardan por separado para
 * que un recargo cobrado no se confunda con abono a una cuota futura.
 */
export async function recordExternalPayment(
  studentId: string,
  principalAmount: number,
  lateFeeAmount: number,
  source: string,
  paidAt: string,
  note: string
): Promise<ActionResult> {
  const staff = await resolveTesoreriaStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const roundedPrincipal = Math.round((principalAmount || 0) * 100) / 100
  const roundedLateFee = Math.round((lateFeeAmount || 0) * 100) / 100

  if (roundedPrincipal < 0 || roundedLateFee < 0) return { ok: false, error: 'Los montos no pueden ser negativos.' }
  if (roundedPrincipal <= 0 && roundedLateFee <= 0) return { ok: false, error: 'Indica un monto mayor a cero.' }
  if (!EXTERNAL_PAYMENT_SOURCE_LABELS[source]) return { ok: false, error: 'Fuente de pago inválida.' }
  if (!paidAt) return { ok: false, error: 'Indica la fecha del pago.' }

  const admin = createAdminClient()

  const { data: student } = await admin
    .from('students')
    .select('id, family_id, school_id')
    .eq('id', studentId)
    .eq('school_id', staff.schoolId)
    .single()
  if (!student) return { ok: false, error: 'No se encontró el estudiante.' }
  const familyId = student.family_id

  let { data: monthlyConcept } = await admin
    .from('billing_concepts')
    .select('id')
    .eq('school_id', staff.schoolId)
    .eq('recurrence', 'monthly')
    .ilike('name', '%mensualidad%')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (!monthlyConcept && roundedPrincipal > 0) {
    const { data: newConcept, error: conceptError } = await admin
      .from('billing_concepts')
      .insert({ school_id: staff.schoolId, name: 'Mensualidad', amount: roundedPrincipal, recurrence: 'monthly', applies_to: 'student' })
      .select('id')
      .single()
    if (conceptError) return { ok: false, error: 'No se pudo preparar el concepto de mensualidad.' }
    monthlyConcept = newConcept
  }

  const paidAtIso = new Date(`${paidAt}T00:00:00`).toISOString()
  const noteSuffix = note.trim() ? ': ' + note.trim() : ''

  async function insertPaidInvoice(options: {
    conceptId: string
    description: string
    amount: number
  }) {
    const { data: invoice, error: invoiceError } = await admin.from('invoices').insert({
      school_id: staff.schoolId,
      family_id: familyId,
      student_id: studentId,
      concept_id: options.conceptId,
      description: options.description,
      amount: options.amount,
      tax_amount: 0,
      total_amount: options.amount,
      due_date: paidAt,
      status: 'pagado',
      paid_at: paidAtIso,
      ncf: null,
      ncf_type: null,
      created_by: staff.staffProfileId,
    }).select('id').single()
    if (invoiceError) return { ok: false as const, error: `No se pudo registrar el pago: ${invoiceError.message}` }

    const { error: paymentError } = await admin.from('payments').insert({
      school_id: staff.schoolId,
      invoice_id: invoice.id,
      amount_paid: options.amount,
      payment_method: source,
      received_by: staff.staffProfileId,
      paid_at: paidAtIso,
      notes: note.trim() || null,
    })
    if (paymentError) return { ok: false as const, error: `Se registró la factura pero no el pago: ${paymentError.message}` }
    return { ok: true as const }
  }

  if (roundedPrincipal > 0) {
    if (!monthlyConcept) return { ok: false, error: 'No se pudo preparar el concepto de mensualidad.' }
    const result = await insertPaidInvoice({
      conceptId: monthlyConcept.id,
      description: `Mensualidad — cobro ya registrado (${EXTERNAL_PAYMENT_SOURCE_LABELS[source]})${noteSuffix}`,
      amount: roundedPrincipal,
    })
    if (!result.ok) return result
  }

  if (roundedLateFee > 0) {
    let { data: lateFeeConcept } = await admin
      .from('billing_concepts')
      .select('id')
      .eq('school_id', staff.schoolId)
      .eq('recurrence', 'one_time')
      .ilike('name', '%recargo%mora%')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()

    if (!lateFeeConcept) {
      const { data: newConcept, error: conceptError } = await admin
        .from('billing_concepts')
        .insert({ school_id: staff.schoolId, name: 'Recargo por Mora', amount: roundedLateFee, recurrence: 'one_time', applies_to: 'student' })
        .select('id')
        .single()
      if (conceptError) return { ok: false, error: 'No se pudo preparar el concepto de recargo.' }
      lateFeeConcept = newConcept
    }

    const result = await insertPaidInvoice({
      conceptId: lateFeeConcept.id,
      description: `Recargo por mora — cobro ya registrado (${EXTERNAL_PAYMENT_SOURCE_LABELS[source]})${noteSuffix}`,
      amount: roundedLateFee,
    })
    if (!result.ok) return result
  }

  revalidatePath('/dashboard/tesoreria/cuentas-por-cobrar')
  revalidatePath('/dashboard/tesoreria')
  return { ok: true }
}
