import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentCard from '@/components/portal/StudentCard'
import SummaryBadge from '@/components/portal/SummaryBadge'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import FamilyChatWidget from '@/components/portal/FamilyChatWidget'

export const metadata: Metadata = {
  title: 'Portal Familiar — MentorIApp',
  description: 'Consulta asistencia, comunicados y pagos de tus hijos.',
}

/**
 * Portal Familiar — Vista principal para padres/tutores
 * Muestra: lista de hijos, últimos comunicados y estado de pagos.
 */
export default async function PortalFamiliarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Obtener el perfil del guardian (incluyendo role para verificar permisos)
  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('role, guardian_id, school_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  if (profile?.role === 'school_admin' || profile?.role === 'director') {
    redirect('/dashboard/secretaria')
  }

  // Obtener los estudiantes vinculados a este guardian
  const { data: students, error: studentsError } = profile?.guardian_id
    ? await supabase
        .from('student_guardians')
        .select(`
          relationship,
          students (
            id, first_name, last_name, photo_url, enrollment_status
          )
        `)
        .eq('guardian_id', profile.guardian_id)
    : { data: [], error: null }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <QueryErrorBanner errors={[{ label: 'tus hijos', error: studentsError }]} />

      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Portal Familiar
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Consulta el estado de tus hijos en el colegio
        </p>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryBadge label="Comunicados" value="Ver" icon="📬" href="/dashboard/comunicados" />
        <SummaryBadge label="Pagos" value="Ver" icon="💳" href="/dashboard/pagos" />
        <SummaryBadge label="Asistencia" value="Ver" icon="📅" href="/dashboard/asistencia" />
      </div>

      {/* Lista de estudiantes */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
          Mis hijos
        </h2>

        {students && students.length > 0 ? (
          <div className="space-y-3">
            {students.map((sg) => {
              // Cast seguro usando unknown como intermediario
              type StudentShape = {
                id: string; first_name: string; last_name: string;
                photo_url: string | null; enrollment_status: string | null
              }
              const student = (sg.students as unknown) as StudentShape | null
              if (!student) return null
              return (
                <StudentCard
                  key={student.id}
                  id={student.id}
                  firstName={student.first_name}
                  lastName={student.last_name}
                  photoUrl={student.photo_url}
                  enrollmentStatus={student.enrollment_status ?? 'N/A'}
                  relationship={sg.relationship}
                />
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center">
            <p className="text-slate-400 dark:text-slate-500 text-sm">
              No hay estudiantes vinculados a tu cuenta.<br />
              Contacta a la secretaría del colegio.
            </p>
          </div>
        )}
      </div>

      {/* Asistente de IA -- "un solo cerebro, dos salidas" (ver AGENTS.md) */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
          Asistente
        </h2>
        <FamilyChatWidget />
      </div>
    </div>
  )
}
