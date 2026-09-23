import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import { SEVERITIES, STATUSES, labelOf, RECIDIVISM_DAYS, RECIDIVISM_LEVES } from '@/lib/incidents/labels'
import { todaySchoolDate } from '@/lib/schoolDate'

export const metadata: Metadata = {
  title: 'Incidencias — MentorIApp',
  description: 'Registro de incidencias y seguimiento conductual.',
}

type Incident = {
  id: string
  student_id: string
  grade_level: string | null
  incident_date: string
  severity: string
  status: string
  reporter_name: string
  students: { first_name: string; last_name: string } | null
}

const severityStyle: Record<string, string> = {
  leve: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  grave: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  muy_grave: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
}

export default async function IncidenciasPage({ searchParams }: { searchParams: Promise<{ estado?: string; gravedad?: string }> }) {
  const { estado, gravedad } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (profileError) console.error('[perfil]', profileError)
  const role = profile?.role ?? ''
  if (!profile || !canAccess(role, 'incidencias')) redirect('/dashboard')

  const isManager = canAccess(role, 'incidencias_gestionar')
  const { schoolId } = await getActiveSchool(role, profile.school_id)

  // Cliente de sesión: la RLS decide qué casos ve cada quien (docente: los
  // suyos y los de sus cursos; dirección: todo el colegio).
  let query = supabase
    .from('student_incidents')
    .select('id, student_id, grade_level, incident_date, severity, status, reporter_name, students(first_name, last_name)')
    .eq('school_id', schoolId)
    .order('incident_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(300)
  if (estado && STATUSES.some((s) => s.value === estado)) query = query.eq('status', estado)
  if (gravedad && SEVERITIES.some((s) => s.value === gravedad)) query = query.eq('severity', gravedad)
  const { data: rowsRaw, error: rowsError } = await query
  const rows = (rowsRaw ?? []) as unknown as Incident[]

  // La Regla del 3, sobre TODO lo visible (no solo lo filtrado): estudiantes
  // con 3+ faltas leves en los últimos 30 días.
  const since = new Date(`${todaySchoolDate()}T00:00:00`)
  since.setDate(since.getDate() - RECIDIVISM_DAYS)
  const { data: recentLevesRaw } = await supabase
    .from('student_incidents')
    .select('student_id, students(first_name, last_name)')
    .eq('school_id', schoolId)
    .eq('severity', 'leve')
    .gt('incident_date', since.toISOString().slice(0, 10))
  const leveCount = new Map<string, { n: number; name: string }>()
  for (const r of (recentLevesRaw ?? []) as unknown as { student_id: string; students: { first_name: string; last_name: string } | null }[]) {
    const prev = leveCount.get(r.student_id)
    leveCount.set(r.student_id, { n: (prev?.n ?? 0) + 1, name: r.students ? `${r.students.first_name} ${r.students.last_name}` : 'Estudiante' })
  }
  const recidivists = Array.from(leveCount.entries()).filter(([, v]) => v.n >= RECIDIVISM_LEVES)

  const openCount = rows.filter((r) => r.status !== 'cerrado').length
  const formatDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
  const filterHref = (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams()
    const merged = { estado, gravedad, ...params }
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v)
    const s = q.toString()
    return `/dashboard/incidencias${s ? `?${s}` : ''}`
  }
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold border transition ${active ? 'bg-primary text-white border-primary' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Incidencias</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isManager ? 'Todos los casos del colegio y su seguimiento.' : 'Registro de incidencias y seguimiento conductual de tus cursos.'}
          </p>
        </div>
        <Link href="/dashboard/incidencias/nueva" className="dash-btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5 shrink-0">
          + Registrar
        </Link>
      </div>

      <QueryErrorBanner errors={[{ label: 'incidencias', error: rowsError }]} />

      {recidivists.length > 0 && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 space-y-1">
          <p className="font-semibold">Reincidencia (Regla del 3): {RECIDIVISM_LEVES}+ faltas leves en {RECIDIVISM_DAYS} días se tratan como falta grave.</p>
          {recidivists.map(([id, v]) => (
            <p key={id}>{v.name}: {v.n} faltas leves</p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={filterHref({ estado: undefined })} className={chip(!estado)}>Todos</Link>
        {STATUSES.map((s) => (
          <Link key={s.value} href={filterHref({ estado: s.value })} className={chip(estado === s.value)}>{s.label}</Link>
        ))}
        <span className="w-px bg-slate-200 dark:bg-slate-700 mx-1" aria-hidden="true" />
        <Link href={filterHref({ gravedad: undefined })} className={chip(!gravedad)}>Toda gravedad</Link>
        {SEVERITIES.map((s) => (
          <Link key={s.value} href={filterHref({ gravedad: s.value })} className={chip(gravedad === s.value)}>{s.label}</Link>
        ))}
      </div>

      <p className="text-xs" style={{ color: 'var(--dash-text-faint)' }}>
        {rows.length} {rows.length === 1 ? 'caso' : 'casos'} · {openCount} sin cerrar
      </p>

      {rows.length === 0 ? (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📝</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>No hay incidencias registradas.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link key={r.id} href={`/dashboard/incidencias/${r.id}`} className="dash-card flex items-center gap-3 p-4 transition">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold shrink-0 ${severityStyle[r.severity] ?? ''}`}>
                {labelOf(SEVERITIES, r.severity)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate" style={{ color: 'var(--dash-text)' }}>
                  {r.students ? `${r.students.first_name} ${r.students.last_name}` : 'Estudiante'}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--dash-text-muted)' }}>
                  {r.grade_level ?? ''} · {formatDate(r.incident_date)} · {r.reporter_name}
                </p>
              </div>
              <span className="text-xs font-semibold shrink-0" style={{ color: r.status === 'cerrado' ? 'var(--dash-text-faint)' : 'var(--dash-warning)' }}>
                {labelOf(STATUSES, r.status)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
