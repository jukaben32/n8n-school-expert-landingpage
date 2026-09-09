'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { reconcileAlegraPayments } from '@/lib/accounting/reconcileAlegraPayments'

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

/** Dispara una conciliación a mano, sin esperar a la corrida de las 7pm. */
export async function runAlegraSyncNow(): Promise<ActionResult & { resumen?: string }> {
  const staff = await resolveTesoreriaStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const result = await reconcileAlegraPayments({ schoolId: staff.schoolId, trigger: 'manual' })

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
    .select('id, school_id, status, amount, assigned_amount, alegra_number, alegra_date, alegra_note, alegra_payment_method')
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
