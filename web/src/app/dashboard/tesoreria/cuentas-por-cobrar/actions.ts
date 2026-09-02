'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { notifyGuardianByEmail } from '@/lib/notifications/notifyGuardianByEmail'
import { lateFeeReference } from '@/lib/receivables/monthReference'

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
    admin.rpc('calculate_receivable_status', { p_student_id: studentId }).single(),
    admin.from('schools').select('name, late_fee_percent').eq('id', staff.schoolId).single(),
    admin.from('guardians').select('email, is_primary').eq('family_id', student.family_id).order('is_primary', { ascending: false }),
  ])

  const status = receivable as {
    overdue_amount: number | null
    oldest_overdue_due_date: string | null
    aging_bucket: string | null
  } | null

  if (!status || !status.oldest_overdue_due_date || status.aging_bucket === 'corriente' || status.aging_bucket === 'sin_configurar') {
    return { ok: false, error: 'Este estudiante no tiene una cuota vencida que avisar.' }
  }

  const recipient = (guardians ?? []).find((g) => g.email)
  if (!recipient?.email) return { ok: false, error: 'La familia no tiene un correo registrado.' }

  const formatDOP = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' })
  const dueDateLabel = new Date(`${status.oldest_overdue_due_date}T00:00:00`).toLocaleDateString('es-DO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  await notifyGuardianByEmail({
    schoolName: school?.name ?? null,
    guardianEmail: recipient.email,
    subject: `Aviso de mensualidad pendiente — ${student.first_name} ${student.last_name}`,
    body: `La mensualidad de ${student.first_name} ${student.last_name} vence desde el ${dueDateLabel} ` +
      `y sigue pendiente (${formatDOP.format(status.overdue_amount ?? 0)}). ` +
      `Puedes ponerte al día ahora para evitar que se aplique el recargo por mora ` +
      `(${school?.late_fee_percent ?? 0}% sobre el monto vencido).`,
  })

  return { ok: true }
}

/**
 * Genera un cargo real por recargo de mora -- única acción de esta pantalla
 * que sí crea una factura. Nunca automático: siempre es el staff quien lo
 * decide, viendo la deuda vencida de ese estudiante en pantalla.
 */
export async function generateLateFeeCharge(studentId: string): Promise<ActionResult> {
  const staff = await resolveTesoreriaStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const admin = createAdminClient()

  const { data: student } = await admin
    .from('students')
    .select('id, family_id, school_id')
    .eq('id', studentId)
    .eq('school_id', staff.schoolId)
    .single()
  if (!student) return { ok: false, error: 'No se encontró el estudiante.' }

  const [{ data: receivable }, { data: school }] = await Promise.all([
    admin.rpc('calculate_receivable_status', { p_student_id: studentId }).single(),
    admin.from('schools').select('late_fee_percent').eq('id', staff.schoolId).single(),
  ])

  const status = receivable as { overdue_amount: number | null; aging_bucket: string | null } | null
  if (!status || !status.overdue_amount || status.overdue_amount <= 0 ||
      status.aging_bucket === 'corriente' || status.aging_bucket === 'sin_configurar' || !status.aging_bucket) {
    return { ok: false, error: 'Este estudiante no tiene deuda vencida sobre la cual aplicar recargo.' }
  }

  const lateFeePercent = school?.late_fee_percent ?? 0
  const feeAmount = Math.round(status.overdue_amount * (lateFeePercent / 100) * 100) / 100
  if (feeAmount <= 0) return { ok: false, error: 'El porcentaje de recargo configurado es 0%.' }

  let { data: concept } = await admin
    .from('billing_concepts')
    .select('id')
    .eq('school_id', staff.schoolId)
    .eq('recurrence', 'one_time')
    .ilike('name', '%recargo%mora%')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (!concept) {
    const { data: newConcept, error: conceptError } = await admin
      .from('billing_concepts')
      .insert({ school_id: staff.schoolId, name: 'Recargo por Mora', amount: feeAmount, recurrence: 'one_time', applies_to: 'student' })
      .select('id')
      .single()
    if (conceptError) return { ok: false, error: 'No se pudo preparar el concepto de recargo.' }
    concept = newConcept
  }

  const reference = lateFeeReference(new Date())

  const { data: ncf, error: ncfError } = await admin.rpc('generate_ncf', { p_school_id: staff.schoolId, p_ncf_type: '02' })
  if (ncfError) return { ok: false, error: 'No se pudo generar el comprobante.' }

  const { error: insertError } = await admin.from('invoices').insert({
    school_id: staff.schoolId,
    family_id: student.family_id,
    student_id: studentId,
    concept_id: concept.id,
    description: `Recargo por mora — ${reference}`,
    amount: feeAmount,
    tax_amount: 0,
    total_amount: feeAmount,
    due_date: new Date().toISOString().slice(0, 10),
    status: 'pendiente',
    ncf,
    ncf_type: '02',
    created_by: staff.staffProfileId,
  })
  if (insertError) return { ok: false, error: `No se pudo generar el recargo: ${insertError.message}` }

  revalidatePath('/dashboard/tesoreria/cuentas-por-cobrar')
  revalidatePath('/dashboard/tesoreria')
  return { ok: true }
}

export const EXTERNAL_PAYMENT_SOURCES = [
  { value: 'alegra', label: 'Alegra (POS)' },
  { value: 'otro', label: 'Otra plataforma' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'cheque', label: 'Cheque' },
] as const

const SOURCE_LABELS: Record<string, string> = Object.fromEntries(EXTERNAL_PAYMENT_SOURCES.map((s) => [s.value, s.label]))

/**
 * Registra un cobro que ya ocurrió fuera de esta plataforma (Alegra POS, u
 * otra plataforma) -- mientras los pagos en línea todavía no están
 * habilitados aquí, este es el único lugar para que Cuentas por Cobrar
 * refleje la realidad. A propósito NUNCA genera NCF (`ncf` queda null):
 * el comprobante fiscal real ya existe en el sistema donde se cobró
 * (Alegra u otro) -- generar uno aquí sería un documento fantasma que no
 * corresponde a ningún cobro real ante la DGII. Esto es puramente un
 * registro interno para que la deuda implícita deje de contar ese dinero
 * como pendiente.
 */
export async function recordExternalPayment(
  studentId: string,
  amount: number,
  source: string,
  paidAt: string,
  note: string
): Promise<ActionResult> {
  const staff = await resolveTesoreriaStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  if (!amount || amount <= 0) return { ok: false, error: 'Indica un monto mayor a cero.' }
  if (!SOURCE_LABELS[source]) return { ok: false, error: 'Fuente de pago inválida.' }
  if (!paidAt) return { ok: false, error: 'Indica la fecha del pago.' }

  const admin = createAdminClient()

  const { data: student } = await admin
    .from('students')
    .select('id, family_id, school_id')
    .eq('id', studentId)
    .eq('school_id', staff.schoolId)
    .single()
  if (!student) return { ok: false, error: 'No se encontró el estudiante.' }

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
    const { data: newConcept, error: conceptError } = await admin
      .from('billing_concepts')
      .insert({ school_id: staff.schoolId, name: 'Mensualidad', amount, recurrence: 'monthly', applies_to: 'student' })
      .select('id')
      .single()
    if (conceptError) return { ok: false, error: 'No se pudo preparar el concepto de mensualidad.' }
    concept = newConcept
  }

  const roundedAmount = Math.round(amount * 100) / 100
  const description = `Mensualidad — cobro ya registrado (${SOURCE_LABELS[source]})${note.trim() ? ': ' + note.trim() : ''}`

  const { data: invoice, error: invoiceError } = await admin.from('invoices').insert({
    school_id: staff.schoolId,
    family_id: student.family_id,
    student_id: studentId,
    concept_id: concept.id,
    description,
    amount: roundedAmount,
    tax_amount: 0,
    total_amount: roundedAmount,
    due_date: paidAt,
    status: 'pagado',
    paid_at: new Date(`${paidAt}T00:00:00`).toISOString(),
    ncf: null,
    ncf_type: null,
    created_by: staff.staffProfileId,
  }).select('id').single()
  if (invoiceError) return { ok: false, error: `No se pudo registrar el pago: ${invoiceError.message}` }

  const { error: paymentError } = await admin.from('payments').insert({
    school_id: staff.schoolId,
    invoice_id: invoice.id,
    amount_paid: roundedAmount,
    payment_method: source,
    received_by: staff.staffProfileId,
    paid_at: new Date(`${paidAt}T00:00:00`).toISOString(),
    notes: note.trim() || null,
  })
  if (paymentError) return { ok: false, error: `Se registró la factura pero no el pago: ${paymentError.message}` }

  revalidatePath('/dashboard/tesoreria/cuentas-por-cobrar')
  revalidatePath('/dashboard/tesoreria')
  return { ok: true }
}
