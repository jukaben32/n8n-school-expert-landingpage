import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { todaySchoolDate } from '@/lib/schoolDate'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import ListadoActions from './ListadoActions'

export const metadata: Metadata = {
  title: 'Listado de asistencia — MentorIApp',
}

const STATUS_LABELS: Record<string, string> = {
  presente: 'Presente',
  ausente: 'Ausente',
  tardanza: 'Tardanza',
  justificado: 'Justificado',
}
const FULL_ACCESS_ROLES = ['super_admin', 'school_admin', 'director', 'reception']
const MAX_RANGE_DAYS = 93
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type AttendanceRow = {
  student_id: string
  date: string
  status: string
  notes: string | null
  subject: { name: string } | null
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}

/**
 * Listado de asistencia por curso y fecha (o rango de fechas) para staff.
 * Un profesor solo ve los cursos que tiene asignados en teacher_assignments;
 * dirección, administración y recepción ven todos. Se puede imprimir/guardar
 * como PDF y descargar para Excel (CSV).
 */
export default async function ListadoAsistenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ curso?: string; desde?: string; hasta?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id, staff_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'asistencia')) redirect('/dashboard/portal-familiar')
  const schoolId = (await getActiveSchool(profile.role, profile.school_id)).schoolId

  // Cursos disponibles: los del colegio, acotados a los asignados si es profesor.
  const { data: gradeRows, error: gradesError } = await supabase
    .from('students')
    .select('grade_level')
    .eq('school_id', schoolId)
    .eq('enrollment_status', 'inscrito')
    .is('deleted_at', null)
  const allGrades = Array.from(
    new Set((gradeRows ?? []).map((s) => s.grade_level as string | null).filter((g): g is string => Boolean(g)))
  ).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))

  let grades = allGrades
  let unassignedTeacher = false
  if (!FULL_ACCESS_ROLES.includes(profile.role)) {
    const admin = createAdminClient()
    const { data: assignments } = profile.staff_id
      ? await admin
          .from('teacher_assignments')
          .select('grade_level')
          .eq('school_id', schoolId)
          .eq('staff_id', profile.staff_id)
      : { data: [] as { grade_level: string | null }[] }
    const rows = assignments ?? []
    if (rows.length === 0) {
      grades = []
      unassignedTeacher = true
    } else if (!rows.some((r) => r.grade_level === null)) {
      const assigned = new Set(rows.map((r) => r.grade_level as string))
      grades = allGrades.filter((g) => assigned.has(g))
    }
  }

  const today = todaySchoolDate()
  const curso = params.curso && grades.includes(params.curso) ? params.curso : ''
  const desde = params.desde && DATE_RE.test(params.desde) ? params.desde : today
  let hasta = params.hasta && DATE_RE.test(params.hasta) ? params.hasta : desde
  let notice: string | null = null
  if (hasta < desde) hasta = desde
  if (daysBetween(desde, hasta) > MAX_RANGE_DAYS) {
    hasta = new Date(Date.parse(desde) + MAX_RANGE_DAYS * 86_400_000).toISOString().slice(0, 10)
    notice = `El rango máximo es de ${MAX_RANGE_DAYS} días; se muestra hasta el ${formatDate(hasta)}.`
  }
  const singleDay = desde === hasta

  let students: { id: string; first_name: string; last_name: string }[] = []
  let records: AttendanceRow[] = []
  let queryError: { message: string } | null = null

  if (curso) {
    const { data: studentData, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('school_id', schoolId)
      .eq('grade_level', curso)
      .eq('enrollment_status', 'inscrito')
      .is('deleted_at', null)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })
    students = studentData ?? []
    queryError = studentsError

    if (students.length > 0) {
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('student_id, date, status, notes, subject:subjects(name)')
        .eq('school_id', schoolId)
        .in('student_id', students.map((s) => s.id))
        .gte('date', desde)
        .lte('date', hasta)
        .order('date', { ascending: true })
      records = ((attendance as unknown) as AttendanceRow[]) ?? []
      queryError = queryError ?? attendanceError
    }
  }

  const byStudent = new Map<string, AttendanceRow[]>()
  for (const r of records) byStudent.set(r.student_id, [...(byStudent.get(r.student_id) ?? []), r])

  // Un día: una fila por registro (o "Sin registro"). Rango: conteo por estudiante.
  const header = singleDay
    ? ['N°', 'Estudiante', 'Materia', 'Estado', 'Nota']
    : ['N°', 'Estudiante', 'Presente', 'Ausente', 'Tardanza', 'Justificado', 'Días registrados']
  const rows: string[][] = []
  students.forEach((s, i) => {
    const name = `${s.last_name}, ${s.first_name}`
    const mine = byStudent.get(s.id) ?? []
    if (singleDay) {
      if (mine.length === 0) rows.push([String(i + 1), name, '', 'Sin registro', ''])
      for (const r of mine) {
        rows.push([String(i + 1), name, r.subject?.name ?? 'General', STATUS_LABELS[r.status] ?? r.status, r.notes ?? ''])
      }
    } else {
      const count = (st: string) => String(mine.filter((r) => r.status === st).length)
      rows.push([String(i + 1), name, count('presente'), count('ausente'), count('tardanza'), count('justificado'), String(mine.length)])
    }
  })

  const periodLabel = singleDay ? formatDate(desde) : `${formatDate(desde)} al ${formatDate(hasta)}`
  const fileName = `asistencia-${curso.replace(/[^\w]+/g, '-')}-${singleDay ? desde : `${desde}_${hasta}`}`
  const inputClass = 'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'los cursos', error: gradesError }, { label: 'la asistencia', error: queryError }]} />
      <div className="print:hidden">
        <Link href="/dashboard/asistencia" className="text-sm text-dash-accent hover:underline">← Asistencia</Link>
        <h1 className="text-2xl font-bold font-barlow tracking-tight mt-2">Listado de asistencia</h1>
        <p className="text-sm text-slate-500 mt-1">Elige el curso y la fecha (o un rango de fechas) para ver, imprimir o descargar el listado.</p>
      </div>

      {unassignedTeacher ? (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Todavía no tienes cursos asignados. Pídele a la dirección o a la secretaría que te asigne tus cursos para poder ver el listado.
        </div>
      ) : (
        <form method="get" className="dash-card p-4 flex flex-wrap items-end gap-3 print:hidden">
          <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
            Curso
            <select name="curso" defaultValue={curso} required className={inputClass}>
              <option value="" disabled>Selecciona un curso</option>
              {grades.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
            Desde
            <input type="date" name="desde" defaultValue={desde} max={today} required className={inputClass} />
          </label>
          <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
            Hasta (opcional)
            <input type="date" name="hasta" defaultValue={singleDay ? '' : hasta} max={today} className={inputClass} />
          </label>
          <button type="submit" className="dash-btn-primary text-sm px-5 py-2.5">Ver listado</button>
        </form>
      )}

      {notice && <p className="text-sm text-amber-700 dark:text-amber-300 print:hidden">{notice}</p>}

      {curso && (
        <div id="listado-print" className="space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-bold font-barlow">Asistencia — {curso}</h2>
              <p className="text-sm text-slate-500">{singleDay ? 'Fecha' : 'Período'}: {periodLabel} · {students.length} estudiantes</p>
            </div>
            {students.length > 0 && <ListadoActions fileName={fileName} header={header} rows={rows} />}
          </div>

          {students.length === 0 ? (
            <div className="dash-card border-dashed p-10 text-center text-sm text-slate-500">
              No hay estudiantes inscritos en este curso.
            </div>
          ) : (
            <div className="dash-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200">
                  <tr>
                    {header.map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-barlow uppercase tracking-wide text-xs text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {r.map((c, j) => (
                        <td key={j} className={`px-4 py-2.5 ${j === 1 ? 'font-medium' : ''} ${c === 'Ausente' ? 'text-red-600 font-semibold' : ''} ${c === 'Sin registro' ? 'text-slate-400' : ''}`}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Al imprimir solo se ve el listado, sin menú ni filtros. */}
      <style>{`@media print {
        body * { visibility: hidden; }
        #listado-print, #listado-print * { visibility: visible; }
        #listado-print { position: absolute; left: 0; top: 0; width: 100%; }
      }`}</style>
    </div>
  )
}
