'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'

interface ActionResult {
  ok: boolean
  error?: string
}

/**
 * Guarda (crea o actualiza) la nota de un estudiante en una materia +
 * periodo. Usa el cliente normal (sujeto a RLS) a propósito: la política
 * grades_teacher_own es la que de verdad determina si este profesor
 * puede calificar a este estudiante en esta materia -- no solo la UI.
 */
export async function setGradeAction(
  studentId: string,
  subjectId: string,
  gradingPeriodId: string,
  score: string,
  comment: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'notas_gestionar')) {
    return { ok: false, error: 'No tienes permiso para registrar notas.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  if (!score.trim()) {
    const { error: delError } = await supabase
      .from('grades')
      .delete()
      .eq('student_id', studentId)
      .eq('subject_id', subjectId)
      .eq('grading_period_id', gradingPeriodId)
    if (delError) return { ok: false, error: 'No se pudo borrar la nota.' }
    revalidatePath('/dashboard/notas')
    return { ok: true }
  }

  const numericScore = Number(score)
  if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
    return { ok: false, error: 'La nota debe ser un número entre 0 y 100.' }
  }

  const { error } = await supabase.from('grades').upsert(
    {
      school_id: schoolId,
      student_id: studentId,
      subject_id: subjectId,
      grading_period_id: gradingPeriodId,
      score: numericScore,
      comment: comment.trim() || null,
      created_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'student_id,subject_id,grading_period_id' }
  )
  if (error) return { ok: false, error: 'No se pudo guardar la nota. Verifica que enseñes esta materia a este estudiante.' }

  revalidatePath('/dashboard/notas')
  return { ok: true }
}
