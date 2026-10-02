import type { SupabaseClient } from '@supabase/supabase-js'

export type FamilyProfile = { guardian_id: string | null; school_id: string | null }
export type FamilyStudent = {
  id: string; school_id: string; first_name: string; last_name: string
  grade_level: string | null; enrollment_status: string | null
}
export type FamilyLesson = {
  id: string; title: string; description: string | null; video_url: string | null
  subjects: { name: string } | null
  actual_lesson_id: string; instructions: string; due_date: string | null; delivery_mode: string
  submission?: { response:string; status:string; feedback:string } | null
}
export type FamilyAttempt = {
  lesson_id: string; score: number; max_score: number; completed_at: string | null
}

// User-scoped client only. Staff with guardian_id gets the same family scope,
// regardless of their wider staff permissions. Never authorize by role alone.
export async function listFamilyStudents(client: SupabaseClient, profile: FamilyProfile) {
  if (!profile.guardian_id || !profile.school_id) return []
  const { data, error } = await client.from('student_guardians')
    .select('students!inner(id, school_id, first_name, last_name, grade_level, enrollment_status)')
    .eq('guardian_id', profile.guardian_id)
    .eq('students.school_id', profile.school_id)
    .is('students.deleted_at', null)
  if (error) throw new Error('No se pudo verificar la lista de tus hijos. Inténtalo de nuevo.')
  return (data ?? []).map(row => row.students as unknown as FamilyStudent)
    .filter(Boolean)
    .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'es'))
}

// Instantiate the admin client ONLY after verifying the requested child.
// These read-only queries compensate for missing guardian progress policies
// without widening RLS for every other screen in the application.
export async function loadFamilyAcademia(
  client: SupabaseClient, profile: FamilyProfile, studentId: string,
  adminFactory: () => SupabaseClient,
) {
  const students = await listFamilyStudents(client, profile)
  const student = students.find(child => child.id === studentId)
  if (!student) return null
  if (!student.grade_level) return { student, students, lessons: [] as FamilyLesson[], attempts: [] as FamilyAttempt[], progressError: false }
  const admin = adminFactory()
  const [lessonsResult, attemptsResult, submissionsResult] = await Promise.all([
    admin.from('academia_assignments').select('id,lesson_id,subject_id,instructions,due_date,delivery_mode,subjects(name),lessons!inner(title,description,video_url,subject_id),academia_assignment_students!inner(student_id)')
      .eq('school_id', student.school_id).eq('grade_level', student.grade_level)
      .eq('academia_assignment_students.student_id',student.id).eq('is_active',true)
      .eq('lessons.school_id',student.school_id).eq('lessons.grade_level',student.grade_level)
      .eq('lessons.is_published', true).is('lessons.deleted_at', null).order('created_at', { ascending: false }),
    admin.from('quiz_attempts').select('assignment_id, score, max_score, completed_at')
      .eq('school_id', student.school_id).eq('student_id', student.id)
      .not('completed_at', 'is', null).order('completed_at', { ascending: false }),
    admin.from('academia_submissions').select('assignment_id,response,status,feedback,reviewed_at').eq('student_id',student.id),
  ])
  if (lessonsResult.error) throw new Error('No se pudieron cargar las tareas. Inténtalo de nuevo.')
  type Row={id:string;lesson_id:string;subject_id:string;instructions:string;due_date:string|null;delivery_mode:string;subjects:{name:string}|null;lessons:{title:string;description:string|null;video_url:string|null;subject_id:string}|null}
  const lessons=((lessonsResult.data ?? []) as unknown as Row[]).filter(a=>a.lessons && a.lessons.subject_id===a.subject_id).map(a=>({
    id:a.id,actual_lesson_id:a.lesson_id,title:a.lessons!.title,description:a.lessons!.description,video_url:a.lessons!.video_url,subjects:a.subjects,
    instructions:a.instructions,due_date:a.due_date,delivery_mode:a.delivery_mode,
    submission:submissionsResult.data?.find(s=>s.assignment_id===a.id)??null,
  }))
  const attempts:FamilyAttempt[]=(attemptsResult.data ?? []).map(q=>({lesson_id:q.assignment_id,score:q.score,max_score:q.max_score,completed_at:q.completed_at}))
  for(const s of submissionsResult.data ?? [])if(s.status==='reviewed' && s.reviewed_at)attempts.push({lesson_id:s.assignment_id,score:0,max_score:0,completed_at:s.reviewed_at})
  return { student,students,lessons,attempts,progressError:!!attemptsResult.error||!!submissionsResult.error }
}

// Latest completed attempt wins; unfinished attempts never mark a task done.
export function latestCompletedAttempts(attempts: FamilyAttempt[]) {
  const result = new Map<string, FamilyAttempt>()
  for (const attempt of attempts) {
    if (!attempt.completed_at) continue
    const previous = result.get(attempt.lesson_id)
    if (!previous || attempt.completed_at > previous.completed_at!) result.set(attempt.lesson_id, attempt)
  }
  return result
}
