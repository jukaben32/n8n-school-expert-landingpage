'use server'

// Un archivo 'use server' solo exporta funciones async (ni constantes ni
// tipos -- ver AGENTS.md). Las etiquetas viven en @/lib/incidents/labels.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { canRecordIncidentFollowUp } from '@/lib/incidents/followUpAccess'
import { getActiveSchool } from '@/lib/activeSchool'
import { roleLabels } from '@/lib/staff/roleLabels'
import { MEASURES, LOCATIONS, SEVERITIES, STATUSES, RECIDIVISM_DAYS, RECIDIVISM_LEVES } from '@/lib/incidents/labels'

interface CreateIncidentInput {
  studentId: string
  incidentDate: string
  incidentTime: string
  location: string
  locationOther: string
  severity: string
  description: string
  measures: string[]
  studentHeard: boolean
}

interface CreateIncidentResult {
  ok: boolean
  error?: string
  id?: string
  /** Cantidad de faltas leves del estudiante en los últimos 30 días, incluida esta. */
  recentLeves?: number
}

/**
 * Registra una incidencia. Con el cliente de SESIÓN a propósito: la policy
 * student_incidents_insert es la que garantiza que el docente solo reporta
 * a estudiantes de sus cursos, en nombre propio y con el curso real.
 */
export async function createIncidentAction(input: CreateIncidentInput): Promise<CreateIncidentResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, staff_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !canAccess(profile.role, 'incidencias')) {
    return { ok: false, error: 'No tienes permiso para registrar incidencias.' }
  }

  const description = input.description.trim()
  if (!input.studentId) return { ok: false, error: 'Elige el estudiante.' }
  if (!input.incidentDate) return { ok: false, error: 'Indica la fecha.' }
  if (!description) return { ok: false, error: 'Describe brevemente los hechos.' }
  if (!SEVERITIES.some((s) => s.value === input.severity)) return { ok: false, error: 'Marca la clasificación de la falta.' }
  if (!LOCATIONS.some((l) => l.value === input.location)) return { ok: false, error: 'Marca el lugar.' }
  const measures = input.measures.filter((m) => MEASURES.some((x) => x.value === m))

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const { data: student } = await supabase
    .from('students')
    .select('id, grade_level')
    .eq('id', input.studentId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!student) return { ok: false, error: 'No se encontró el estudiante (o no está en tus cursos).' }

  // Nombre de quien reporta, congelado en el registro. Cliente admin solo
  // para leer SU PROPIA ficha (staff no está abierta a todos los roles).
  let reporterName = user.email ?? 'Personal del colegio'
  if (profile.staff_id) {
    const { data: me } = await createAdminClient().from('staff').select('first_name, last_name, role').eq('id', profile.staff_id).maybeSingle()
    if (me) reporterName = `${me.first_name} ${me.last_name} (${roleLabels[me.role as string] ?? me.role})`
  }

  const { data, error } = await supabase
    .from('student_incidents')
    .insert({
      school_id: schoolId,
      student_id: student.id,
      grade_level: student.grade_level,
      incident_date: input.incidentDate,
      incident_time: input.incidentTime || null,
      location: input.location,
      location_other: input.location === 'otro' ? input.locationOther.trim() || null : null,
      severity: input.severity,
      description,
      measures,
      student_heard: input.studentHeard,
      reported_by: profile.id,
      reporter_name: reporterName,
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: `No se pudo guardar la incidencia. ${error?.message ?? ''}`.trim() }

  // La Regla del 3: cuántas leves lleva este estudiante en los últimos 30 días.
  let recentLeves: number | undefined
  if (input.severity === 'leve') {
    const since = new Date(`${input.incidentDate}T00:00:00`)
    since.setDate(since.getDate() - RECIDIVISM_DAYS)
    const { count } = await supabase
      .from('student_incidents')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', student.id)
      .eq('severity', 'leve')
      .gt('incident_date', since.toISOString().slice(0, 10))
      .lte('incident_date', input.incidentDate)
    recentLeves = count ?? undefined
  }

  revalidatePath('/dashboard/incidencias')
  return { ok: true, id: data.id, recentLeves: recentLeves && recentLeves >= RECIDIVISM_LEVES ? recentLeves : undefined }
}

interface FollowUpInput {
  incidentId: string
  status: string
  notes: string
}

/** Seguimiento de Orientación / Gestión: Dirección o la psicóloga (lo impone la RLS). */
export async function updateIncidentFollowUpAction(input: FollowUpInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !(await canRecordIncidentFollowUp(supabase, profile.role, profile.school_id))) {
    return { ok: false, error: 'Solo Dirección o la psicóloga pueden registrar el seguimiento.' }
  }
  if (!STATUSES.some((s) => s.value === input.status)) return { ok: false, error: 'Estado no válido.' }

  const { data, error } = await supabase
    .from('student_incidents')
    .update({
      status: input.status,
      follow_up_notes: input.notes.trim() || null,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.incidentId)
    .select('id')
  // Sin .select(), una policy que bloquea el update devuelve 0 filas sin error.
  if (error || !data || data.length === 0) return { ok: false, error: 'No se pudo guardar el seguimiento.' }

  revalidatePath('/dashboard/incidencias')
  revalidatePath(`/dashboard/incidencias/${input.incidentId}`)
  return { ok: true }
}
