import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import NewLessonForm from './NewLessonForm'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Nueva Lección — MentorIApp',
}

export default async function NuevaLeccionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  const schoolId = (await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')).schoolId
  if (!profile || !canAccess(profile.role, 'academia_gestionar')) {
    redirect('/dashboard/academia')
  }

  // Los cursos salen de `students.grade_level` -- el mismo texto libre que
  // ya usan Horarios, Notas, Asistencia y Encuestas. NO del catálogo
  // `grade_levels`: nadie lo mantiene (4 filas para 12 cursos reales) y la
  // tabla `enrollments` que lo conectaba con el alumno está vacía porque
  // ninguna pantalla la escribe nunca. Ver la migración
  // 20260909000000_academia_curso_texto.sql.
  const [{ data: subjects, error: subjectsError }, { data: studentRows, error: coursesError }] = await Promise.all([
    supabase.from('subjects').select('id, name').eq('school_id', schoolId).order('name'),
    supabase
      .from('students')
      .select('grade_level')
      .eq('school_id', schoolId)
      .eq('enrollment_status', 'inscrito')
      .is('deleted_at', null)
      .not('grade_level', 'is', null),
  ])

  const courses = Array.from(
    new Set(((studentRows ?? []) as { grade_level: string | null }[])
      .map((r) => r.grade_level)
      .filter((g): g is string => !!g && g.trim() !== '')),
  ).sort((a, b) => a.localeCompare(b, 'es'))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'las materias', error: subjectsError }, { label: 'los cursos', error: coursesError }]} />
      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">
          Nueva Lección
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Un video explicativo + un cuestionario corto para reforzar el tema.
        </p>
      </div>

      <NewLessonForm
        schoolId={schoolId}
        authorProfileId={profile.id}
        subjects={subjects ?? []}
        courses={courses}
      />
    </div>
  )
}
