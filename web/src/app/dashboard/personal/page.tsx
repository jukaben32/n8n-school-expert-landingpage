import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import GrantAccessButton from './GrantAccessButton'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Personal — SchoolOS',
  description: 'Personal y docentes del colegio, con su ficha profesional.',
}

const roleLabels: Record<string, string> = {
  director: 'Director', coordinator: 'Coordinador', teacher: 'Docente',
  assistant: 'Asistente', finance: 'Finanzas', reception: 'Recepción',
  nurse: 'Enfermería', admin: 'Administración',
  security: 'Seguridad', janitor: 'Conserje', cafeteria_assistant: 'Auxiliar de Cafetería',
  cleaning_assistant: 'Auxiliar de Limpieza', doorman: 'Portero', secretary: 'Secretaria',
  teaching_secretary: 'Secretaria Docente', teaching_assistant: 'Ayudante Docente',
  administrator: 'Administrador', psychologist: 'Psicóloga',
}
const educationLabels: Record<string, string> = {
  tecnico: 'Técnico', bachiller: 'Bachiller', licenciatura: 'Licenciatura',
  maestria: 'Maestría', doctorado: 'Doctorado',
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
    .select('staff_id')
    .eq('school_id', schoolId)
    .not('staff_id', 'is', null)
  const staffWithAccess = new Set((linkedProfiles ?? []).map((p) => p.staff_id as string))

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
        <Link
          href="/dashboard/personal/nuevo"
          className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 transition shadow-glow"
        >
          + Agregar personal
        </Link>
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
                <p className="text-xs text-slate-400 dark:text-slate-500 shrink-0">Desde {formatDate(s.hire_date)}</p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                {staffWithAccess.has(s.id) ? (
                  <p className="text-xs font-semibold text-green-600 dark:text-green-400">✓ Tiene acceso al sistema</p>
                ) : (
                  <GrantAccessButton staffId={s.id} suggestedRole={s.role} />
                )}
              </div>

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
