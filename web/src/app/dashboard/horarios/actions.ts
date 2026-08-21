'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'

interface ActionResult {
  ok: boolean
  error?: string
}

/**
 * Asigna (o borra, si subjectId y staffId vienen vacíos) la materia y
 * profesor de una franja puntual del horario de un grado. Solo
 * super_admin/school_admin/director -- es decisión administrativa, un
 * profesor no puede reasignarse a sí mismo a otras franjas.
 */
export async function setScheduleSlotAction(
  gradeLevel: string,
  dayOfWeek: number,
  periodId: string,
  subjectId: string,
  staffId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'horarios_gestionar')) {
    return { ok: false, error: 'No tienes permiso para gestionar horarios.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  const admin = createAdminClient()

  if (!subjectId && !staffId) {
    const { error } = await admin
      .from('class_schedules')
      .delete()
      .eq('school_id', schoolId)
      .eq('grade_level', gradeLevel)
      .eq('day_of_week', dayOfWeek)
      .eq('period_id', periodId)
    if (error) return { ok: false, error: 'No se pudo borrar la clase.' }
    revalidatePath('/dashboard/horarios')
    return { ok: true }
  }

  const { error } = await admin
    .from('class_schedules')
    .upsert(
      {
        school_id: schoolId,
        grade_level: gradeLevel,
        day_of_week: dayOfWeek,
        period_id: periodId,
        subject_id: subjectId || null,
        staff_id: staffId || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'school_id,grade_level,day_of_week,period_id' }
    )
  if (error) return { ok: false, error: 'No se pudo guardar la clase.' }

  revalidatePath('/dashboard/horarios')
  return { ok: true }
}
