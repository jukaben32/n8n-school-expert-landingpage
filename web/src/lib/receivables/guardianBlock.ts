import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Fase 2 de Cuentas por Cobrar: ¿tiene este tutor mora de 61 días o más?
 * Usado por dashboard/layout.tsx (alerta roja) y, solo si
 * OVERDUE_PORTAL_BLOCK_ENABLED está activo, por proxy.ts (redirección a
 * /dashboard/pagos), el menú reducido y los avisos de Academia. Importar
 * desde este único lugar para no duplicar la lógica.
 *
 * Trato VIP a quien paga por adelantado (decisión del colegio, 2026-11-17):
 * el bloqueo es una medida de castigo y NUNCA debe caerle a una familia que
 * pagó de más o por adelantado. Reporte real: dos familias que pagaron el
 * año quedaron bloqueadas porque un cobro no se importó y otro se le cargó
 * a la hermana equivocada. Por eso se bloquea SOLO si se cumplen las tres:
 *
 *   1. Algún hijo inscrito está en el tramo "61+".
 *   2. Ningún hijo de la familia tiene el año escolar pagado
 *      (student_tuition_year_status) -- quien adelantó el año es VIP.
 *   3. La FAMILIA, sumando a todos los hijos, debe de verdad: lo cobrado
 *      no alcanza lo exigible a la fecha. Un pago cargado al hermano
 *      equivocado deja a uno "debiendo" y a otro "adelantado"; en conjunto
 *      la familia está al día y no se le bloquea.
 *   4. No hay un cobro de Alegra de esta familia esperando en la bandeja de
 *      revisión: si el colegio todavía no lo ha atribuido, no es culpa del
 *      padre.
 *
 * Usa el cliente admin (service_role) porque schools/school_years/
 * billing_concepts no tienen política RLS para tutores; el resultado nunca
 * se expone al cliente, solo decide la redirección/el banner server-side.
 */

/**
 * Interruptor del confinamiento a Pagos (decisión del colegio, 2026-11-26:
 * se levanta la restricción). En `false`, la mora de 61+ solo muestra una
 * alerta fija en el panel; el tutor conserva todo el portal. Ponerlo en
 * `true` vuelve a activar la redirección, el menú reducido y el corte de los
 * avisos de Academia, sin tocar nada más.
 */
export const OVERDUE_PORTAL_BLOCK_ENABLED: boolean = false

interface StatusRow {
  aging_bucket?: string | null
  expected_to_date?: number | string | null
  collected_amount?: number | string | null
}

interface YearRow {
  year_paid?: boolean | null
}

export async function checkGuardianOverdueBlock(guardianId: string): Promise<boolean> {
  const admin = createAdminClient()

  const { data: guardian } = await admin
    .from('guardians')
    .select('family_id')
    .eq('id', guardianId)
    .single()
  if (!guardian?.family_id) return false

  const { data: students } = await admin
    .from('students')
    .select('id')
    .eq('family_id', guardian.family_id)
    .eq('enrollment_status', 'inscrito')
    .is('deleted_at', null)
  if (!students || students.length === 0) return false

  const statuses = await Promise.all(
    students.map((s) => admin.rpc('calculate_receivable_status', { p_student_id: s.id }).maybeSingle())
  )
  const rows = statuses.map((r) => (r.data as StatusRow | null) ?? null)

  // 1. Nadie en 61+: nada que hacer (el caso de casi todas las familias).
  if (!rows.some((r) => r?.aging_bucket === '61+')) return false

  // 2. VIP: algún hijo con el año escolar pagado por adelantado.
  const years = await Promise.all(
    students.map((s) => admin.rpc('student_tuition_year_status', { p_student_id: s.id }).maybeSingle())
  )
  if (years.some((r) => (r.data as YearRow | null)?.year_paid === true)) return false

  // 3. La familia en conjunto no debe nada a la fecha.
  const exigible = rows.reduce((sum, r) => sum + Number(r?.expected_to_date ?? 0), 0)
  const cobrado = rows.reduce((sum, r) => sum + Number(r?.collected_amount ?? 0), 0)
  if (cobrado + 0.01 >= exigible) return false

  // 4. Un cobro de esta familia esperando atribución en la bandeja de Alegra.
  const ids = new Set(students.map((s) => s.id))
  const { data: pendientes } = await admin
    .from('alegra_payment_matches')
    .select('candidates')
    .eq('status', 'pendiente')
  const tienePendiente = (pendientes ?? []).some((m) =>
    Array.isArray(m.candidates) &&
    (m.candidates as { studentId?: string }[]).some((c) => !!c.studentId && ids.has(c.studentId))
  )
  if (tienePendiente) return false

  return true
}
