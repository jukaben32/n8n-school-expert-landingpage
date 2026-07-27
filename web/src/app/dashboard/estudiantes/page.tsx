import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Estudiantes — SchoolOS',
  description: 'Listado de estudiantes inscritos en el colegio.',
}

const statusStyles: Record<string, string> = {
  prospecto:  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  inscrito:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  admitido:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  retirado:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

type StudentRow = {
  id: string
  first_name: string
  last_name: string
  birth_date: string
  enrollment_status: string | null
  families: { name: string } | null
}

/**
 * Página de Estudiantes — Solo para staff.
 * Lista los estudiantes del colegio con su familia y estado de inscripción.
 */
export default async function EstudiantesPage() {
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
  if (!profile || !canAccess(profile.role, 'estudiantes')) {
    redirect('/dashboard/portal-familiar')
  }

  const { data: studentsRaw, error: studentsError } = await supabase
    .from('students')
    .select('id, first_name, last_name, birth_date, enrollment_status, families(name)')
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .order('last_name', { ascending: true })

  const students = (studentsRaw ?? []) as unknown as StudentRow[]

  const formatBirthDate = (d: string) =>
    new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'los estudiantes', error: studentsError }]} />

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Estudiantes
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {students.length} estudiante{students.length !== 1 ? 's' : ''} registrado{students.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          id="btn-nuevo-estudiante"
          href="/dashboard/estudiantes/nuevo"
          className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 transition shadow-glow"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo estudiante
        </Link>
      </div>

      {/* Tabla de estudiantes */}
      {studentsError && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <p className="font-semibold">No se pudo cargar la lista de estudiantes.</p>
          <p className="mt-1 font-mono text-xs">{studentsError.message}</p>
        </div>
      )}

      {students.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Nombre</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Familia</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Nacimiento</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    <Link href={`/dashboard/estudiantes/${s.id}`} className="block">
                      {s.last_name}, {s.first_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {s.families?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {formatBirthDate(s.birth_date)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusStyles[s.enrollment_status ?? ''] ?? statusStyles.prospecto}`}>
                      {s.enrollment_status ?? 'prospecto'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">🎒</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Aún no hay estudiantes registrados en este colegio.
          </p>
        </div>
      )}
    </div>
  )
}
