import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAlegraStudentContacts, alegraIsConfigured } from './alegraClient'
import { planStudentCodeLinks, isStudentCode, type LinkPlan } from './alegraStudentCodes'

/**
 * Trae las matrículas de Alegra y las guarda en `students.student_code`
 * cuando el emparejamiento es seguro (ver `alegraStudentCodes.ts`).
 * NUNCA cambia un nombre: manda el de la plataforma.
 *
 * Corre sola al inicio de cada conciliación y también desde el botón
 * "Vincular matrículas" de la bandeja. Es idempotente: solo toca
 * estudiantes que todavía no tienen matrícula.
 *
 * Server-only (usa service_role); quien la llame debe haber autorizado
 * antes. Siempre acotada a `schoolId`.
 */
export async function syncStudentCodesFromAlegra(schoolId: string): Promise<LinkPlan & { applied: number; errors: string[] }> {
  const empty = { links: [], suggestions: [], unmatched: 0, alreadyLinked: 0, applied: 0, errors: [] as string[] }
  if (!alegraIsConfigured()) return { ...empty, errors: ['Faltan ALEGRA_EMAIL/ALEGRA_TOKEN en el servidor.'] }

  const admin = createAdminClient()
  const [contacts, { data: students, error }] = await Promise.all([
    fetchAlegraStudentContacts(),
    admin.from('students')
      .select('id, first_name, last_name, student_code')
      .eq('school_id', schoolId)
      .is('deleted_at', null),
  ])
  if (error) return { ...empty, errors: [`No se pudo leer estudiantes: ${error.message}`] }

  const plan = planStudentCodeLinks(contacts, students ?? [])
  let applied = 0
  const errors: string[] = []
  for (const link of plan.links) {
    // `.is('student_code', null)`: nunca pisa una matrícula puesta a mano
    // entre la lectura y esta escritura.
    const { data, error: upErr } = await admin.from('students')
      .update({ student_code: link.code })
      .eq('id', link.studentId).eq('school_id', schoolId).is('student_code', null)
      .select('id')
    if (upErr) errors.push(`${link.studentName}: ${upErr.message}`)
    else if ((data ?? []).length > 0) applied++
  }
  return { ...plan, applied, errors }
}

/**
 * Aprende la matrícula a partir de un cobro ya atribuido (automático o
 * resuelto a mano en la bandeja): si la factura de Alegra venía a nombre
 * del estudiante con su matrícula (tipo IE) y la ficha aún no la tiene, se
 * guarda. Así un cobro que hubo que resolver a mano una vez se empareja
 * solo la próxima. Best-effort: nunca hace fallar el registro del cobro.
 */
export async function learnStudentCode(
  schoolId: string,
  studentId: string,
  idType: string | null | undefined,
  identification: string | null | undefined
): Promise<boolean> {
  const code = (identification ?? '').trim()
  if ((idType ?? '').toUpperCase() !== 'IE' || !isStudentCode(code)) return false
  const admin = createAdminClient()
  const { data: enUso } = await admin.from('students')
    .select('id').eq('school_id', schoolId).eq('student_code', code).is('deleted_at', null).limit(1)
  if ((enUso ?? []).length > 0) return false
  const { data, error } = await admin.from('students')
    .update({ student_code: code })
    .eq('id', studentId).eq('school_id', schoolId).is('student_code', null)
    .select('id')
  if (error) { console.error('[alegra] No se pudo guardar la matrícula aprendida:', error.message); return false }
  return (data ?? []).length > 0
}
