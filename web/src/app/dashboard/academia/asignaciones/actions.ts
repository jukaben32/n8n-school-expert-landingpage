'use server'
import { getAcademiaStaff } from '@/lib/academia/staffContext'
import { revalidatePath } from 'next/cache'

export async function assignTask(form: FormData) {
  const { db, profile, schoolId, scopes } = await getAcademiaStaff()
  const grade = String(form.get('grade') ?? '')
  const subject = String(form.get('subject') ?? '')
  if (!scopes.some(s => s.grade_level === grade && s.subject_id === subject)) return { error: 'No tienes permiso para ese curso y materia.' }
  const due = String(form.get('due') ?? '')
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: 'La fecha no es válida.' }
  const instructions = String(form.get('instructions') ?? '').trim()
  if (instructions.length > 10000) return { error: 'Las instrucciones son demasiado largas.' }
  let id: string | undefined
  if (form.get('kind') === 'manual') {
    const { data, error } = await db.rpc('academia_create_manual_assignment', {
      p_school: schoolId, p_grade: grade, p_subject: subject, p_title: String(form.get('title') ?? '').trim(),
      p_instructions: instructions, p_due: due || null, p_mode: String(form.get('mode') ?? 'text'),
    })
    if (error) return { error: error.message }
    id = data as string
  } else {
    const { data: lesson, error: lessonError } = await db.from('lessons').select('id')
      .eq('id', String(form.get('lesson') ?? '')).eq('school_id', schoolId).eq('grade_level', grade)
      .eq('subject_id', subject).eq('is_published', true).eq('is_library', true).is('deleted_at', null).maybeSingle()
    if (lessonError || !lesson) return { error: 'Selecciona una lección disponible de tu biblioteca.' }
    const { data, error } = await db.from('academia_assignments').insert({ school_id: schoolId, lesson_id: lesson.id,
      grade_level: grade, subject_id: subject, instructions, due_date: due || null, delivery_mode: 'quiz', created_by: profile.id,
    }).select('id').single()
    if (error) return { error: error.message }
    id = data.id
  }
  revalidatePath('/dashboard/academia')
  revalidatePath('/dashboard/academia/asignaciones')
  return { id }
}

export async function updateTask(id: string, active: boolean, due: string) {
  const { db, schoolId } = await getAcademiaStaff()
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: 'La fecha no es válida.' }
  const { data, error } = await db.from('academia_assignments').update({ is_active: active, due_date: due || null })
    .eq('id', id).eq('school_id', schoolId).select('id').single()
  if (error || !data) return { error: 'No se pudo guardar la tarea. Comprueba tus permisos.' }
  revalidatePath('/dashboard/academia/asignaciones')
  revalidatePath('/dashboard/academia')
  return { ok: true }
}

export async function reviewTask(assignment: string, student: string, status: string, feedback: string) {
  const { db, schoolId } = await getAcademiaStaff()
  const { data: task } = await db.from('academia_assignments').select('id').eq('id', assignment).eq('school_id', schoolId).maybeSingle()
  if (!task) return { error: 'No tienes acceso a esta tarea.' }
  const { error } = await db.rpc('academia_review_submission', { p_assignment: assignment, p_student: student, p_status: status, p_feedback: feedback })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/academia/asignaciones')
  return { ok: true }
}
