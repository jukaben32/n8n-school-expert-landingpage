import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import GrantAccessButton from './GrantAccessButton'
import ChangeAccessRoleButton, { accessRoleLabels } from './ChangeAccessRoleButton'
import PublicRegistrationLinkButton from './PublicRegistrationLinkButton'
import TeacherGradeAssignments from './TeacherGradeAssignments'
import EditStaffButton from './EditStaffButton'
import DeleteStaffButton from './DeleteStaffButton'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import { roleLabels, educationLabels } from '@/lib/staff/roleLabels'

export const metadata: Metadata = {
  title: 'Personal — MentorIApp',
  description: 'Personal y docentes del colegio, con su ficha profesional.',
}

type StaffRow = {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  role: string
  hire_date: string
  education_level: string | null
  degree_title: string | null
  alma_mater: string | null
  specialty: string | null
}

/**
 * Personal — Solo para dirección/administración/súper admin.
 * Ficha de cada empleado: datos de contacto + formación profesional.
 */
export default async function PersonalPage() {
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
  const { data: schoolRow } = await supabase.from('schools').select('subdomain').eq('id', schoolId).single()
  const { count: pendingRegistrationsCount } = await supabase
    .from('staff_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('status', 'pendiente')

  if (!profile || !canAccess(profile.role, 'personal')) {
    redirect('/dashboard')
  }

  const { data: staffRaw, error: staffError } = await supabase
    .from('staff')
    .select('id, first_name, last_name, email, phone, role, hire_date, education_level, degree_title, alma_mater, specialty')
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .order('last_name', { ascending: true })

  const staff = (staffRaw ?? []) as StaffRow[]

  const { data: linkedProfiles, error: linkedProfilesError } = await supabase
    .from('users_profiles')
    .select('id, staff_id, role')
    .eq('school_id', schoolId)
    .not('staff_id', 'is', null)
  const staffWithAccess = new Map(
    (linkedProfiles ?? []).map((p) => [p.staff_id as string, { profileId: p.id as string, role: p.role as string }])
  )

  const [{ data: assignments }, { data: studentsWithGrade }] = await Promise.all([
    supabase.from('teacher_assignments').select('staff_id, grade_level').eq('school_id', schoolId),
    supabase.from('students').select('grade_level').eq('school_id', schoolId).not('grade_level', 'is', null).is('deleted_at', null),
  ])
  const gradesByStaff = new Map<string, string[]>()
  for (const a of assignments ?? []) {
    const list = gradesByStaff.get(a.staff_id as string) ?? []
    list.push(a.grade_level as string)
    gradesByStaff.set(a.staff_id as string, list)
  }
  const gradeLevelOptions = Array.from(
    new Set((studentsWithGrade ?? []).map((s) => s.grade_level as string).filter(Boolean))
  ).sort()

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'el personal', error: staffError }, { label: 'los accesos', error: linkedProfilesError }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Personal</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {staff.length} miembro{staff.length !== 1 ? 's' : ''} del equipo
          </p>
        </div>
        <div className="flex items-center gap-3">
          {schoolRow?.subdomain && (
            <PublicRegistrationLinkButton subdomain={schoolRow.subdomain} />
          )}
          <Link
            href="/dashboard/personal/registros"
            className="relative inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Registros pendientes
            {!!pendingRegistrationsCount && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                {pendingRegistrationsCount}
              </span>
            )}
          </Link>
          <Link
            href="/dashboard/personal/nuevo"
            className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 transition shadow-glow"
          >
            + Agregar personal
          </Link>
        </div>
      </div>

      {staffError && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <p className="font-semibold">No se pudo cargar la lista de personal.</p>
          <p className="mt-1 font-mono text-xs">{staffError.message}</p>
        </div>
      )}

      {staff.length > 0 ? (
        <div className="grid gap-3">
          {staff.map((s) => (
            <div key={s.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 dark:text-white">{s.first_name} {s.last_name}</p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary dark:text-accent-light">
                      {roleLabels[s.role] ?? s.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.email} {s.phone ? `· ${s.phone}` : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <p className="text-xs text-slate-400 dark:text-slate-500">Desde {formatDate(s.hire_date)}</p>
                  <div className="flex items-center gap-3">
                    <EditStaffButton staff={s} />
                    <DeleteStaffButton staffId={s.id} fullName={`${s.first_name} ${s.last_name}`} />
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                {staffWithAccess.has(s.id) ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-xs font-semibold text-green-600 dark:text-green-400">
                      ✓ Acceso: {accessRoleLabels[staffWithAccess.get(s.id)!.role] ?? staffWithAccess.get(s.id)!.role}
                    </p>
                    <ChangeAccessRoleButton
                      profileId={staffWithAccess.get(s.id)!.profileId}
                      currentRole={staffWithAccess.get(s.id)!.role}
                    />
                  </div>
                ) : (
                  <GrantAccessButton staffId={s.id} suggestedRole={s.role} />
                )}
              </div>

              {s.role === 'teacher' && (
                <TeacherGradeAssignments
                  staffId={s.id}
                  initialGrades={gradesByStaff.get(s.id) ?? []}
                  gradeLevelOptions={gradeLevelOptions}
                />
              )}

              {(s.degree_title || s.alma_mater || s.specialty) && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {s.degree_title && (
                    <div>
                      <p className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px]">Título</p>
                      <p className="text-slate-700 dark:text-slate-300">{s.degree_title}{s.education_level ? ` (${educationLabels[s.education_level] ?? s.education_level})` : ''}</p>
                    </div>
                  )}
                  {s.alma_mater && (
                    <div>
                      <p className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px]">Egresado de</p>
                      <p className="text-slate-700 dark:text-slate-300">{s.alma_mater}</p>
                    </div>
                  )}
                  {s.specialty && (
                    <div>
                      <p className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px]">Especialidad</p>
                      <p className="text-slate-700 dark:text-slate-300">{s.specialty}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">🧑‍🏫</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Aún no hay personal registrado.</p>
        </div>
      )}
    </div>
  )
}
