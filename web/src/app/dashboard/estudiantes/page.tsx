import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Estudiantes — MentorIApp',
  description: 'Listado de estudiantes inscritos en el colegio.',
}

const statusColors: Record<string, string> = {
  prospecto: 'var(--dash-text-muted)',
  inscrito:  'var(--dash-accent)',
  admitido:  '#6ee7b7',
  retirado:  'var(--dash-danger-strong)',
}

type StudentRow = {
  id: string
  first_name: string
  last_name: string
  birth_date: string
  enrollment_status: string | null
  grade_level: string | null
  families: { name: string } | null
}

/**
 * Página de Estudiantes — Solo para staff.
 * Lista los estudiantes del colegio con su familia, curso y estado de
 * inscripción. Filtro por curso vía ?curso=... (searchParams, no hace
 * falta un componente cliente para esto).
 */
export default async function EstudiantesPage({
  searchParams,
}: {
  searchParams: Promise<{ curso?: string }>
}) {
  const { curso } = await searchParams
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

  let query = supabase
    .from('students')
    .select('id, first_name, last_name, birth_date, enrollment_status, grade_level, families(name)')
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .order('grade_level', { ascending: true, nullsFirst: false })
    .order('last_name', { ascending: true })

  if (curso) query = query.eq('grade_level', curso)

  const { data: studentsRaw, error: studentsError } = await query

  const students = (studentsRaw ?? []) as unknown as StudentRow[]

  // Cursos disponibles para el filtro -- consulta aparte, sin filtrar, para
  // que las opciones no desaparezcan cuando ya hay un curso seleccionado.
  const { data: gradesRaw } = await supabase
    .from('students')
    .select('grade_level')
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .not('grade_level', 'is', null)
  const gradeOptions = Array.from(
    new Set((gradesRaw ?? []).map((s) => s.grade_level as string).filter(Boolean))
  ).sort()

  const formatBirthDate = (d: string) =>
    new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'los estudiantes', error: studentsError }]} />

      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">
            Estudiantes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {students.length} estudiante{students.length !== 1 ? 's' : ''} registrado{students.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {canAccess(profile.role, 'estudiantes_accesos') && (
            <Link
              id="btn-accesos-estudiantes"
              href="/dashboard/estudiantes/accesos"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 text-slate-600 text-sm font-semibold px-5 py-2.5 transition hover:bg-slate-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 12.75v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Accesos
            </Link>
          )}
          {canAccess(profile.role, 'estudiantes_escaneos') && (
            <Link
              id="btn-escanear-fichas"
              href="/dashboard/estudiantes/escaneos"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 text-slate-600 text-sm font-semibold px-5 py-2.5 transition hover:bg-slate-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M4.5 9h15M4.5 15h15" />
              </svg>
              Escanear fichas
            </Link>
          )}
          <Link
            id="btn-nuevo-estudiante"
            href="/dashboard/estudiantes/nuevo"
            className="dash-btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuevo estudiante
          </Link>
        </div>
      </div>

      {/* Filtro por curso */}
      {gradeOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/estudiantes"
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold font-barlow uppercase tracking-wide transition"
            style={!curso ? { background: 'var(--dash-accent)', color: 'var(--dash-bg)' } : { background: 'white', color: '#5f7a70', border: '1px solid #e2e8f0' }}
          >
            Todos los cursos
          </Link>
          {gradeOptions.map((grade) => (
            <Link
              key={grade}
              href={`/dashboard/estudiantes?curso=${encodeURIComponent(grade)}`}
              className="rounded-full px-3.5 py-1.5 text-xs font-semibold font-barlow uppercase tracking-wide transition"
              style={curso === grade ? { background: 'var(--dash-accent)', color: 'var(--dash-bg)' } : { background: 'white', color: '#5f7a70', border: '1px solid #e2e8f0' }}
            >
              {grade}
            </Link>
          ))}
        </div>
      )}

      {/* Tabla de estudiantes */}
      {studentsError && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">No se pudo cargar la lista de estudiantes.</p>
          <p className="mt-1 font-mono text-xs">{studentsError.message}</p>
        </div>
      )}

      {students.length > 0 ? (
        <div className="dash-card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="border-b" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
              <tr>
                <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Nombre</th>
                <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Curso</th>
                <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Familia</th>
                <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Nacimiento</th>
                <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs text-center" style={{ color: 'var(--dash-text-muted)' }}>Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgba(150,225,196,.08)' }}>
              {students.map((s) => (
                <tr key={s.id} className="transition hover:bg-white/5">
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--dash-text)' }}>
                    <Link href={`/dashboard/estudiantes/${s.id}`} className="block">
                      {s.last_name}, {s.first_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--dash-text-muted)' }}>
                    {s.grade_level ?? '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--dash-text-muted)' }}>
                    {s.families?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--dash-text-faint)' }}>
                    {formatBirthDate(s.birth_date)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="px-2 py-1 rounded-full text-[10px] font-bold font-barlow uppercase tracking-wider border"
                      style={{ color: statusColors[s.enrollment_status ?? ''] ?? statusColors.prospecto, borderColor: 'currentColor' }}
                    >
                      {s.enrollment_status ?? 'prospecto'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">🎒</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
            {curso
              ? `Ningún estudiante activo en "${curso}".`
              : 'Aún no hay estudiantes registrados en este colegio.'}
          </p>
        </div>
      )}
    </div>
  )
}
