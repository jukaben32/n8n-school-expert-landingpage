import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AttendanceForm from './AttendanceForm'

export const metadata: Metadata = {
  title: 'Registrar Asistencia — SchoolOS',
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

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  const staffRoles = ['director', 'school_admin', 'teacher', 'reception', 'super_admin']
  if (!profile || !staffRoles.includes(profile.role)) {
    redirect('/dashboard/portal-familiar')
  }

  // Cargar estudiantes inscritos del colegio
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name')
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .order('last_name', { ascending: true })

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Registrar Asistencia
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Al marcar una ausencia o tardanza, los padres recibirán un aviso automático.
        </p>
      </div>

      <AttendanceForm
        students={students ?? []}
        defaultDate={today}
        recorderProfileId={profile.id}
        schoolId={profile.school_id}
      />
    </div>
  )
}
