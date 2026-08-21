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

async function resolveAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'horarios_gestionar')) {
    return { ok: false as const, error: 'No tienes permiso para gestionar horarios.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, schoolId }
}

export async function createPeriodAction(name: string, startTime: string, endTime: string, sortOrder: number): Promise<ActionResult> {
  const resolved = await resolveAdmin()
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'El nombre es obligatorio.' }
  if (!startTime || !endTime) return { ok: false, error: 'La hora de inicio y fin son obligatorias.' }
  if (endTime <= startTime) return { ok: false, error: 'La hora de fin debe ser después de la de inicio.' }

  const admin = createAdminClient()
  const { error } = await admin.from('class_periods').insert({
    school_id: resolved.schoolId,
    name: trimmed,
    start_time: startTime,
    end_time: endTime,
    sort_order: sortOrder,
  })
  if (error) return { ok: false, error: 'No se pudo crear la franja horaria.' }

  revalidatePath('/dashboard/horarios/periodos')
  revalidatePath('/dashboard/horarios')
  return { ok: true }
}

export async function deletePeriodAction(periodId: string): Promise<ActionResult> {
  const resolved = await resolveAdmin()
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const admin = createAdminClient()
  const { error } = await admin.from('class_periods').delete().eq('id', periodId).eq('school_id', resolved.schoolId)
  if (error) return { ok: false, error: 'No se pudo borrar la franja horaria.' }

  revalidatePath('/dashboard/horarios/periodos')
  revalidatePath('/dashboard/horarios')
  return { ok: true }
}
