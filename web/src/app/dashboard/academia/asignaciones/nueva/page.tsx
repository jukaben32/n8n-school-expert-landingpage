import { getAcademiaStaff } from '@/lib/academia/staffContext'
import StaffAcademiaNav from '@/components/academia/StaffAcademiaNav'
import AssignmentForm from './AssignmentForm'
export const metadata = { title: 'Asignar tarea — MentorIApp' }
export default async function Page({ searchParams }: { searchParams: Promise<{ leccion?: string; curso?: string; materia?: string }> }) {
  const params = await searchParams
  const { db, schoolId, scopes } = await getAcademiaStaff()
  const selected = params.leccion ? await db.from('academia_staff_lessons').select('id,title,grade_level,subject_id').eq('id', params.leccion).eq('school_id', schoolId).eq('is_library', true).eq('is_published', true).is('deleted_at', null).maybeSingle() : null
  const grade = selected?.data?.grade_level ?? params.curso ?? scopes[0]?.grade_level
  const subject = selected?.data?.subject_id ?? params.materia ?? scopes.find(s => s.grade_level === grade)?.subject_id
  const { data, error } = await db.from('academia_staff_lessons').select('id,title,grade_level,subject_id').eq('school_id', schoolId)
    .eq('grade_level', grade ?? '').eq('subject_id', subject ?? '00000000-0000-0000-0000-000000000000').eq('is_library', true).eq('is_published', true).is('deleted_at', null).order('title').limit(100)
  if (error) throw Error('No se pudo cargar la biblioteca.')
  const lessons = [...(data ?? [])]
  const selectedLesson=selected?.data
  if (selectedLesson && !lessons.some(l => l.id === selectedLesson.id)) lessons.push(selectedLesson)
  return <div className="max-w-3xl mx-auto space-y-6"><StaffAcademiaNav /><h1 className="text-2xl font-bold">Asignar tarea</h1>
    {!scopes.length && <p className="dash-card p-5">No tienes cursos y materias autorizados. Dirección debe revisar tus asignaciones de curso y, en Secundaria, el horario con tus materias.</p>}
    <AssignmentForm key={`${grade}-${subject}`} scopes={scopes} lessons={lessons} initialLesson={selected?.data?.id} initialGrade={grade} initialSubject={subject} />
  </div>
}
