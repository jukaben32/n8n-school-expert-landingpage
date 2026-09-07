import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Progreso — Academia — MentorIApp',
}

type QuestionRow = {
  id: string
  lesson_id: string
  prompt: string
  sort_order: number
  points: number
  quiz_options: { id: string; label: string; is_correct: boolean; sort_order: number }[]
}

type LessonRow = {
  id: string
  title: string
  grade_level: string | null
  video_url: string
  is_published: boolean
  subjects: { name: string } | null
}

type AttemptRow = {
  id: string
  score: number
  max_score: number
  completed_at: string
  lessons: { title: string; subjects: { name: string } | null } | null
  students: { first_name: string; last_name: string } | null
}

/**
 * Panel de progreso — Solo para staff/profesores.
 * Muestra los intentos de cuestionario completados, con el puntaje
 * obtenido, para dar seguimiento al avance de cada estudiante.
 */
export default async function ProgresoAcademiaPage() {
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
  if (!profile || !canAccess(profile.role, 'academia_gestionar')) {
    redirect('/dashboard/academia')
  }

  // Red de seguridad: si una consulta o una transformación de datos lanza
  // una excepción, se muestra el mensaje real aquí en vez del "Algo salió
  // mal" genérico de dashboard/error.tsx (Next.js oculta el mensaje real en
  // producción). Esta pantalla es solo para staff, así que el detalle no se
  // le expone a una familia ni a un estudiante.
  //
  // OJO -- lo que este try/catch NO atrapa: los errores que React lanza al
  // SERIALIZAR el árbol devuelto (ej. pasar un `onClick` desde un Server
  // Component). Esos ocurren después de que esta función retornó, así que
  // no pasan por aquí. Fue exactamente lo que tumbó esta pantalla el
  // 2026-09-07 y por lo que este try/catch, puesto ese mismo día para
  // diagnosticar, no sirvió de nada hasta encontrar la causa real.
  //
  // `redirect()`/`notFound()` de Next lanzan un error especial con `digest`
  // que empieza en 'NEXT_' -- hay que dejarlo pasar sin capturarlo, o
  // rompería cualquier redirección futura dentro del bloque.
  try {
    return await renderProgreso(supabase, schoolId)
  } catch (e) {
    const digest = (e as { digest?: string } | null)?.digest
    if (digest?.startsWith('NEXT_')) throw e
    const err = e as Error
    console.error('[academia/progreso]', err)
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 space-y-2">
          <p className="font-semibold">Error real al cargar Progreso — Academia (visible solo para staff):</p>
          <p className="font-mono text-xs">{err?.message ?? String(e)}</p>
          {err?.stack && <pre className="font-mono text-[10px] whitespace-pre-wrap opacity-70">{err.stack}</pre>}
        </div>
      </div>
    )
  }
}

async function renderProgreso(supabase: Awaited<ReturnType<typeof createClient>>, schoolId: string) {
  const { data: attemptsRaw, error: attemptsRawError } = await supabase
    .from('quiz_attempts')
    .select('id, score, max_score, completed_at, lessons(title, subjects(name)), students(first_name, last_name)')
    .eq('school_id', schoolId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(100)

  // El catálogo completo, no solo el conteo: antes esta pantalla solo
  // mostraba cuestionarios YA contestados, así que con 9 lecciones cargadas
  // y ningún estudiante que las hubiera abierto todavía, al personal le
  // decía "aún no hay cuestionarios completados. Crea tu primera lección".
  const { data: lessonsRaw, error: lessonsError } = await supabase
    .from('lessons')
    .select('id, title, grade_level, video_url, is_published, subjects(name)')
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  const lessons = (lessonsRaw ?? []) as unknown as LessonRow[]

  // Las preguntas completas, no solo el conteo: dirección tiene que poder
  // LEER el cuestionario antes de que llegue a un estudiante. Hasta ahora
  // el cuestionario solo era visible desde dentro de la lección, y esa
  // pantalla es exclusiva del alumno (redirige si no hay student_id).
  const { data: preguntasRaw, error: preguntasError } = await supabase
    .from('quiz_questions')
    .select('id, lesson_id, prompt, sort_order, points, quiz_options(id, label, is_correct, sort_order)')
    .in('lesson_id', lessons.length ? lessons.map((l) => l.id) : ['00000000-0000-0000-0000-000000000000'])
    .order('sort_order', { ascending: true })

  const preguntas = (preguntasRaw ?? []) as unknown as QuestionRow[]
  const preguntasPorLeccion = new Map<string, QuestionRow[]>()
  for (const q of preguntas) {
    if (!preguntasPorLeccion.has(q.lesson_id)) preguntasPorLeccion.set(q.lesson_id, [])
    preguntasPorLeccion.get(q.lesson_id)!.push(q)
  }

  const porMateria = new Map<string, LessonRow[]>()
  for (const l of lessons) {
    const materia = l.subjects?.name ?? 'Sin materia'
    if (!porMateria.has(materia)) porMateria.set(materia, [])
    porMateria.get(materia)!.push(l)
  }
  const materias = Array.from(porMateria.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))

  const attempts = (attemptsRaw ?? []) as unknown as AttemptRow[]
  const lowScoreThreshold = 0.6

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'los intentos', error: attemptsRawError }, { label: 'las lecciones', error: lessonsError }, { label: 'los cuestionarios', error: preguntasError }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">
            Progreso — Academia
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {lessons.length} lecciones · {attempts.length} cuestionarios completados por estudiantes
          </p>
        </div>
        <Link
          href="/dashboard/academia/nueva"
          className="dash-btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5"
        >
          + Nueva lección
        </Link>
      </div>

      {/* Catálogo de lecciones */}
      {materias.length > 0 && (
        <div className="space-y-5">
          {materias.map(([materia, suyas]) => (
            <section key={materia} className="space-y-2">
              <h2 className="text-sm font-bold font-barlow uppercase tracking-wider" style={{ color: 'var(--dash-text-muted)' }}>
                {materia} · {suyas.length}
              </h2>
              <div className="dash-card divide-y" style={{ borderColor: 'rgba(150,225,196,.08)' }}>
                {suyas.map((l) => {
                  const qs = (preguntasPorLeccion.get(l.id) ?? []).sort((a, b) => a.sort_order - b.sort_order)
                  return (
                    <details key={l.id} className="group">
                      <summary className="px-4 py-3 flex items-center justify-between gap-4 cursor-pointer list-none">
                        <div className="min-w-0">
                          <p className="font-semibold truncate" style={{ color: 'var(--dash-text)' }}>{l.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--dash-text-faint)' }}>
                            {l.grade_level ?? 'sin curso'} · {qs.length} preguntas ·
                            <span className="group-open:hidden"> ver cuestionario</span>
                            <span className="hidden group-open:inline"> ocultar</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {l.is_published ? (
                            <span className="rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[11px] font-bold px-2.5 py-1">
                              Publicada
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-bold px-2.5 py-1">
                              Borrador
                            </span>
                          )}
                          {/* NO agregar onClick aquí. Esto es un Server
                              Component: pasar una función como prop a un
                              elemento hace que React lance "Event handlers
                              cannot be passed to Client Component props" al
                              SERIALIZAR el árbol -- después de que la función
                              de página ya retornó, así que ni un try/catch
                              alrededor lo atrapa, y `tsc`/`next build` pasan
                              limpios porque esta ruta es dinámica (ƒ) y solo
                              revienta en una petición real. Eso fue justo lo
                              que tumbó esta pantalla el 2026-09-07 (ver
                              AGENTS.md). El enlace abre en pestaña nueva; que
                              además despliegue el acordeón es inofensivo. */}
                          <a
                            href={l.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold underline"
                            style={{ color: 'var(--dash-accent)' }}
                          >
                            Ver video
                          </a>
                        </div>
                      </summary>

                      {qs.length > 0 ? (
                        <ol className="px-4 pb-4 pt-1 space-y-4">
                          {qs.map((q, i) => (
                            <li key={q.id} className="rounded-xl p-4" style={{ background: 'rgba(150,225,196,.06)' }}>
                              <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>
                                {i + 1}. {q.prompt}
                              </p>
                              <ul className="mt-2 space-y-1">
                                {/* Supabase puede devolver `null` en vez de `[]` para un embed
                                    de uno-a-muchos sin filas visibles -- spreadear eso reventaba
                                    toda la pagina con "Algo salió mal" (2026-09-07). Mismo patrón
                                    defensivo que ya usa el resto de este archivo (`?? []`). */}
                                {[...(q.quiz_options ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((o) => (
                                  <li
                                    key={o.id}
                                    className="text-sm flex items-start gap-2"
                                    style={{ color: o.is_correct ? 'var(--dash-accent)' : 'var(--dash-text-muted)' }}
                                  >
                                    <span aria-hidden="true">{o.is_correct ? '✓' : '·'}</span>
                                    <span className={o.is_correct ? 'font-semibold' : ''}>{o.label}</span>
                                  </li>
                                ))}
                              </ul>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="px-4 pb-4 text-sm" style={{ color: 'var(--dash-text-faint)' }}>
                          Esta lección todavía no tiene cuestionario.
                        </p>
                      )}
                    </details>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Cuestionarios contestados */}
      <h2 className="text-sm font-bold font-barlow uppercase tracking-wider pt-2" style={{ color: 'var(--dash-text-muted)' }}>
        Cuestionarios contestados
      </h2>
      {attempts.length > 0 ? (
        <div className="dash-card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="border-b" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
              <tr>
                <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Estudiante</th>
                <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Lección</th>
                <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs" style={{ color: 'var(--dash-text-muted)' }}>Materia</th>
                <th className="px-4 py-3 font-barlow uppercase tracking-wide text-xs text-center" style={{ color: 'var(--dash-text-muted)' }}>Puntaje</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgba(150,225,196,.08)' }}>
              {attempts.map((a) => {
                const ratio = a.max_score > 0 ? a.score / a.max_score : 0
                const isLow = ratio < lowScoreThreshold
                return (
                  <tr key={a.id} className="transition hover:bg-white/5">
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--dash-text)' }}>
                      {a.students ? `${a.students.last_name}, ${a.students.first_name}` : '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--dash-text-muted)' }}>{a.lessons?.title ?? '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--dash-text-faint)' }}>{a.lessons?.subjects?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-bold border"
                        style={{ color: isLow ? 'var(--dash-danger-strong)' : 'var(--dash-accent)', borderColor: 'currentColor' }}
                      >
                        {a.score}/{a.max_score} {isLow && '⚠️'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📊</p>
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
            {lessons.length > 0
              ? 'Todavía ningún estudiante ha contestado un cuestionario. Aparecerán aquí en cuanto lo hagan.'
              : 'Aún no hay lecciones. Crea la primera para empezar.'}
          </p>
        </div>
      )}
    </div>
  )
}
