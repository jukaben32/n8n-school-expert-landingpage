import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { todaySchoolDate } from '@/lib/schoolDate'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import NewIncidentForm from './NewIncidentForm'

export const metadata: Metadata = {
  title: 'Registrar incidencia — MentorIApp',
}

export default async function NuevaIncidenciaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile || !canAccess(profile.role, 'incidencias')) redirect('/dashboard')

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  // Cliente de sesión: a un docente la RLS de `students` ya le limita la
  // lista a sus cursos asignados. Solo inscritos (lista activa de curso).
  const { data: studentsRaw, error: studentsError } = await supabase
    .from('students')
    .select('id, first_name, last_name, grade_level')
    .eq('school_id', schoolId)
    .eq('enrollment_status', 'inscrito')
    .is('deleted_at', null)
    .not('grade_level', 'is', null)
    .order('grade_level')
    .order('last_name')
  const students = (studentsRaw ?? []).map((s) => ({
    id: s.id as string,
    name: `${s.first_name} ${s.last_name}`,
    grade: s.grade_level as string,
  }))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard/incidencias" className="text-sm font-semibold" style={{ color: 'var(--dash-accent-light)' }}>
        ← Incidencias
      </Link>
      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Registro de incidencia</h1>
        <p className="text-sm text-slate-500 mt-1">Registro de Incidencia y Seguimiento Conductual.</p>
      </div>
      <QueryErrorBanner errors={[{ label: 'estudiantes', error: studentsError }]} />
      <NewIncidentForm students={students} today={todaySchoolDate()} />
    </div>
  )
}
