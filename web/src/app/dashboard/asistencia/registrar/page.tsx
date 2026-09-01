import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { todaySchoolDate } from '@/lib/schoolDate'
import { redirect } from 'next/navigation'
import AttendanceForm from './AttendanceForm'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Registrar Asistencia — MentorIApp',
}

/**
 * Página de registro de asistencia — Solo para staff.
 * Carga la lista de estudiantes del colegio para registrar asistencia.
 * Al guardar, el trigger de BD dispara la Edge Function notify-attendance.
 */
export default async function RegistrarAsistenciaPage() {
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
  if (!profile || !canAccess(profile.role, 'asistencia_registrar')) {
    redirect('/dashboard/portal-familiar')
  }

  // Cargar estudiantes inscritos y materias del colegio. Un profesor da
  // varias materias (o la misma materia a varios grupos) en secundaria, así
  // que el formulario necesita saber qué materias existen para poder pedir
  // que se elija una antes de pasar lista.
  const [
    { data: students, error: studentsError },
    { data: subjects, error: subjectsError },
  ] = await Promise.all([
    supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('last_name', { ascending: true }),
    supabase
      .from('subjects')
      .select('id, name')
      .eq('school_id', schoolId)
      .order('name', { ascending: true }),
  ])

  const today = todaySchoolDate()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'los estudiantes', error: studentsError }, { label: 'las materias', error: subjectsError }]} />
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Registrar Asistencia
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Elige la materia y la fecha. Al marcar una ausencia o tardanza, los padres recibirán un aviso automático.
        </p>
      </div>

      {subjects?.length === 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Este colegio todavía no tiene materias configuradas. Pide a un administrador que las cree en{' '}
          <a href="/dashboard/horarios" className="underline font-semibold">Horarios</a> antes de pasar lista.
        </div>
      )}

      <AttendanceForm
        students={students ?? []}
        subjects={subjects ?? []}
        defaultDate={today}
        recorderProfileId={profile.id}
        schoolId={schoolId}
      />
    </div>
  )
}
