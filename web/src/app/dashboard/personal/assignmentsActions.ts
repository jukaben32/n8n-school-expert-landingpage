'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { MESSAGE_CATEGORIES, type MessageCategory } from '@/lib/messaging/categoryAccess'

interface ActionResult {
  ok: boolean
  error?: string
}

// Reemplaza los grados/secciones asignados a un profesor PARA UNA
// CATEGORÍA -- más simple que comparar cuáles se agregaron/quitaron, y la
// lista suele ser corta (un puñado de grados por profesor). Solo borra las
// filas de esa categoría, no toca las demás (un profesor puede tener
// asignaciones en más de una categoría, ej. regular + inglés).
// `wholeSchool=true` guarda una sola fila con grade_level=null -- "todo el
// colegio para esta categoría" (ej. el único docente de Deporte).
export async function setTeacherGradeAssignmentsAction(
  staffId: string,
  category: MessageCategory,
  gradeLevels: string[],
  wholeSchool = false
): Promise<ActionResult> {
  if (!MESSAGE_CATEGORIES.includes(category)) {
    return { ok: false, error: 'Categoría inválida.' }
  }

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

  const { error: deleteError } = await admin
    .from('teacher_assignments')
    .delete()
    .eq('staff_id', staffId)
    .eq('category', category)
  if (deleteError) return { ok: false, error: deleteError.message }

  if (wholeSchool) {
    const { error: insertError } = await admin
      .from('teacher_assignments')
      .insert({ school_id: schoolId, staff_id: staffId, category, grade_level: null })
    if (insertError) return { ok: false, error: insertError.message }
  } else {
    const cleaned = Array.from(new Set(gradeLevels.map((g) => g.trim()).filter(Boolean)))
    if (cleaned.length > 0) {
      const { error: insertError } = await admin.from('teacher_assignments').insert(
        cleaned.map((grade_level) => ({ school_id: schoolId, staff_id: staffId, category, grade_level }))
      )
      if (insertError) return { ok: false, error: insertError.message }
    }
  }

  revalidatePath('/dashboard/personal')
  return { ok: true }
}
