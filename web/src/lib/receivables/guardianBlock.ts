import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Fase 2 de Cuentas por Cobrar: ¿algún hijo inscrito de este tutor tiene la
 * cuota más vieja vencida hace más de 60 días (tramo "61+" de
 * calculate_receivable_status)? Usado tanto por el middleware (redirección
 * dura a /dashboard/pagos, ver proxy.ts) como por dashboard/layout.tsx
 * (banner rojo + menú restringido) -- importa desde este único lugar para
 * no duplicar la lógica entre los dos.
 *
 * Usa el cliente admin (service_role) porque schools/school_years/
 * billing_concepts no tienen política RLS para tutores; el resultado nunca
 * se expone al cliente, solo decide la redirección/el banner server-side.
 */
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

  const results = await Promise.all(
    students.map((s) => admin.rpc('calculate_receivable_status', { p_student_id: s.id }).single())
  )

  return results.some((r) => (r.data as { aging_bucket?: string } | null)?.aging_bucket === '61+')
}
