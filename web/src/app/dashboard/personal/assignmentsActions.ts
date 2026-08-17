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

// Reemplaza por completo los grados/secciones asignados a un profesor --
// más simple que comparar cuáles se agregaron/quitaron, y la lista suele
// ser corta (un puñado de grados por profesor).
export async function setTeacherGradeAssignmentsAction(staffId: string, gradeLevels: string[]): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'personal')) {
    return { ok: false, error: 'No tienes permiso para asignar grados/secciones.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  const admin = createAdminClient()

  const { data: staffRow } = await admin.from('staff').select('id').eq('id', staffId).eq('school_id', schoolId).maybeSingle()
  if (!staffRow) return { ok: false, error: 'No se encontró ese miembro del personal.' }

  const { error: deleteError } = await admin.from('teacher_assignments').delete().eq('staff_id', staffId)
  if (deleteError) return { ok: false, error: deleteError.message }

  const cleaned = Array.from(new Set(gradeLevels.map((g) => g.trim()).filter(Boolean)))
  if (cleaned.length > 0) {
    const { error: insertError } = await admin.from('teacher_assignments').insert(
      cleaned.map((grade_level) => ({ school_id: schoolId, staff_id: staffId, grade_level }))
    )
    if (insertError) return { ok: false, error: insertError.message }
  }

  revalidatePath('/dashboard/personal')
  return { ok: true }
}
