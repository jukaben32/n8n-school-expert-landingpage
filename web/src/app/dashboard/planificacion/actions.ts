'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'

interface ActionResult {
  ok: boolean
  error?: string
}

export interface SavePlanInput {
  scheduleId: string
  planDate: string
  topic: string
  objective: string
  activities: string
  materials: string
  homework: string
}

/**
 * Guarda (crea o actualiza) el plan de una clase puntual. La autorización
 * real la hace RLS en `lesson_plans` (admin ve todo, profesor solo sus
 * propias franjas de class_schedules) -- aquí solo se confirma sesión y
 * permiso general del módulo.
 */
export async function savePlanAction(input: SavePlanInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'planificacion')) {
    return { ok: false, error: 'No tienes permiso para planificar clases.' }
  }

  const topic = input.topic.trim()
  if (!topic) return { ok: false, error: 'El tema de la clase es obligatorio.' }
  if (!input.planDate) return { ok: false, error: 'La fecha es obligatoria.' }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  // Con el cliente normal (sujeto a RLS) a propósito: así, si un profesor
  // intenta planificar una franja que no es suya, la política de
  // lesson_plans_teacher_own lo rechaza de verdad, no solo la UI.
  const { error } = await supabase.from('lesson_plans').upsert(
    {
      school_id: schoolId,
      schedule_id: input.scheduleId,
      plan_date: input.planDate,
      topic,
      objective: input.objective.trim() || null,
      activities: input.activities.trim() || null,
      materials: input.materials.trim() || null,
      homework: input.homework.trim() || null,
      created_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'schedule_id,plan_date' }
  )
  if (error) return { ok: false, error: 'No se pudo guardar la planificación. Verifica que esta clase sea tuya.' }

  revalidatePath('/dashboard/planificacion')
  return { ok: true }
}

export async function deletePlanAction(scheduleId: string, planDate: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { error } = await supabase
    .from('lesson_plans')
    .delete()
    .eq('schedule_id', scheduleId)
    .eq('plan_date', planDate)
  if (error) return { ok: false, error: 'No se pudo borrar la planificación.' }

  revalidatePath('/dashboard/planificacion')
  return { ok: true }
}
