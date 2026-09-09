'use client'

import { useMemo, useState } from 'react'
import { compareGradeLevels } from '@/lib/schedule/gradeLevelOrder'

/**
 * Catálogo de lecciones de Academia, para el personal.
 *
 * Es un componente CLIENTE a propósito: el filtro necesita `onChange`, y
 * `progreso/page.tsx` es un Server Component -- pasarle una función como prop
 * desde ahí es exactamente lo que tumbó esta pantalla el 2026-09-07 ("Event
 * handlers cannot be passed to Client Component props", que `tsc`/`next build`
 * no detectan porque la ruta es dinámica). Toda la interactividad vive aquí y
 * la página solo le entrega datos planos ya serializables.
 *
 * Agrupa por CURSO primero y por materia después, al revés de como estaba: el
 * modelo mental del docente es "mi curso", y a la maestra de 1ro las lecciones
 * de 6to no le sirven nunca. Con 10 lecciones el orden viejo solo se veía
 * raro; con las 93 del plan de 1ro la lista deja de servir.
 */

export type CatalogOption = { id: string; label: string; is_correct: boolean }
export type CatalogQuestion = { id: string; prompt: string; opciones: CatalogOption[] }
export type CatalogLesson = {
  id: string
  title: string
  grade_level: string | null
  video_url: string
  is_published: boolean
  materia: string
  preguntas: CatalogQuestion[]
}

/**
 * Mismo estilo que los desplegables de "Nueva Lección"
 * (`NewLessonForm.tsx`), sin `w-full` porque aquí van en una fila.
 */
const selectClass =
  'min-w-[12rem] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'

const SIN_CURSO = 'Sin curso'
const TODOS = ''

export default function LessonCatalog({ lecciones }: { lecciones: CatalogLesson[] }) {
  const [curso, setCurso] = useState(TODOS)
  const [materia, setMateria] = useState(TODOS)

  // Las opciones de los dos filtros salen del catálogo real, no de un catálogo
  // aparte: si una lección existe, su curso y su materia se pueden elegir.
  const cursos = useMemo(
    () => Array.from(new Set(lecciones.map((l) => l.grade_level ?? SIN_CURSO))).sort(compareGradeLevels),
    [lecciones]
  )
  const materias = useMemo(
    () => Array.from(new Set(lecciones.map((l) => l.materia))).sort((a, b) => a.localeCompare(b, 'es')),
    [lecciones]
  )

  const visibles = useMemo(
    () =>
      lecciones.filter(
        (l) =>
          (curso === TODOS || (l.grade_level ?? SIN_CURSO) === curso) &&
          (materia === TODOS || l.materia === materia)
      ),
    [lecciones, curso, materia]
  )

  // Curso -> materia -> lecciones. El orden dentro de cada materia es el que
  // ya trae el arreglo (la página lo pide por `sort_order`), así que aquí no
  // se reordena nada más.
  const porCurso = useMemo(() => {
    const mapa = new Map<string, Map<string, CatalogLesson[]>>()
    for (const l of visibles) {
      const c = l.grade_level ?? SIN_CURSO
      if (!mapa.has(c)) mapa.set(c, new Map())
      const materiasDelCurso = mapa.get(c)!
      if (!materiasDelCurso.has(l.materia)) materiasDelCurso.set(l.materia, [])
      materiasDelCurso.get(l.materia)!.push(l)
    }
    return Array.from(mapa.entries())
      .sort((a, b) => compareGradeLevels(a[0], b[0]))
      .map(([c, ms]) => [c, Array.from(ms.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))] as const)
  }, [visibles])

  const filtrando = curso !== TODOS || materia !== TODOS

  return (
    <div className="space-y-5">
      {/* Filtros. Solo aparecen si hay más de una opción que elegir: con un
          solo curso cargado no aportan nada y estorban. */}
      {(cursos.length > 1 || materias.length > 1) && (
        <div className="flex flex-wrap items-end gap-3">
          {cursos.length > 1 && (
            <label className="text-xs font-semibold" style={{ color: 'var(--dash-text-muted)' }}>
              Curso
              <select
                value={curso}
                onChange={(e) => setCurso(e.target.value)}
                className={`${selectClass} mt-1 block`}
              >
                <option value={TODOS}>Todos los cursos</option>
                {cursos.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
          {materias.length > 1 && (
            <label className="text-xs font-semibold" style={{ color: 'var(--dash-text-muted)' }}>
              Materia
              <select
                value={materia}
                onChange={(e) => setMateria(e.target.value)}
                className={`${selectClass} mt-1 block`}
              >
                <option value={TODOS}>Todas las materias</option>
                {materias.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          )}
          {filtrando && (
            <button
              type="button"
              onClick={() => { setCurso(TODOS); setMateria(TODOS) }}
              className="text-xs font-semibold underline pb-2"
              style={{ color: 'var(--dash-accent)' }}
            >
              Quitar filtros ({visibles.length} de {lecciones.length})
            </button>
          )}
        </div>
      )}

      {visibles.length === 0 ? (
        <div className="dash-card border-dashed p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>
            No hay lecciones con ese filtro.
          </p>
        </div>
      ) : (
        porCurso.map(([nombreCurso, materiasDelCurso]) => (
          <section key={nombreCurso} className="space-y-3">
            <h2 className="text-base font-bold font-barlow tracking-tight" style={{ color: 'var(--dash-text)' }}>
              {nombreCurso}
              <span className="ml-2 text-xs font-semibold" style={{ color: 'var(--dash-text-faint)' }}>
                {materiasDelCurso.reduce((n, [, ls]) => n + ls.length, 0)} lecciones
              </span>
            </h2>

            {materiasDelCurso.map(([nombreMateria, suyas]) => (
              <div key={nombreMateria} className="space-y-2">
                <h3 className="text-xs font-bold font-barlow uppercase tracking-wider" style={{ color: 'var(--dash-text-muted)' }}>
                  {nombreMateria} · {suyas.length}
                </h3>
                <div className="dash-card divide-y" style={{ borderColor: 'rgba(150,225,196,.08)' }}>
                  {suyas.map((l) => (
                    <details key={l.id} className="group">
                      <summary className="px-4 py-3 flex items-center justify-between gap-4 cursor-pointer list-none">
                        <div className="min-w-0">
                          <p className="font-semibold truncate" style={{ color: 'var(--dash-text)' }}>{l.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--dash-text-faint)' }}>
                            {l.preguntas.length} preguntas ·
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
                          {/* Ancla simple, SIN onClick, igual que antes: que
                              además despliegue el acordeón es inofensivo y
                              evita reintroducir el patrón que ya rompió esto. */}
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

                      {l.preguntas.length > 0 ? (
                        <ol className="px-4 pb-4 pt-1 space-y-4">
                          {l.preguntas.map((q, i) => (
                            <li key={q.id} className="rounded-xl p-4" style={{ background: 'rgba(150,225,196,.06)' }}>
                              <p className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>
                                {i + 1}. {q.prompt}
                              </p>
                              <ul className="mt-2 space-y-1">
                                {q.opciones.map((o) => (
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
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  )
}
