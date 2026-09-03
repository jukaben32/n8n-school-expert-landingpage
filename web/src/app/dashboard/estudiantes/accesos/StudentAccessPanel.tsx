'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { grantGradeAccess, grantStudentAccess, resetStudentPassword, type StudentCredential } from './actions'

interface RosterEntry {
  id: string
  name: string
  gradeLevel: string
  accessCode: string | null
  hasAccess: boolean
}

interface Props {
  roster: RosterEntry[]
  gradeLevelOptions: string[]
}

/**
 * Panel de accesos, curso por curso.
 *
 * Las credenciales recién creadas se muestran en una hoja aparte pensada
 * para imprimirse: la contraseña no se puede volver a consultar después
 * (Supabase guarda solo el hash), así que este es el único momento en que
 * el colegio la ve.
 */
export default function StudentAccessPanel({ roster, gradeLevelOptions }: Props) {
  const router = useRouter()
  const [gradeLevel, setGradeLevel] = useState(gradeLevelOptions[0] ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<StudentCredential[]>([])

  const visible = roster.filter((s) => s.gradeLevel === gradeLevel)
  const pending = visible.filter((s) => !s.hasAccess)

  async function run(action: () => Promise<{ ok: boolean; message: string; credentials?: StudentCredential[] }>) {
    setBusy(true)
    setError(null)
    setNotice(null)
    const result = await action()
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setNotice(result.message)
    setCredentials(result.credentials ?? [])
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {/* Selector de curso + acción masiva */}
      <div className="dash-card p-5 space-y-4">
        <div className="grid sm:grid-cols-[1fr_auto] gap-3 sm:items-end">
          <div>
            <label htmlFor="gradeLevel" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Curso
            </label>
            <select
              id="gradeLevel"
              value={gradeLevel}
              onChange={(e) => { setGradeLevel(e.target.value); setCredentials([]); setNotice(null); setError(null) }}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100"
            >
              {gradeLevelOptions.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <button
            type="button"
            disabled={busy || pending.length === 0}
            onClick={() => run(() => grantGradeAccess(gradeLevel))}
            className="dash-btn-primary text-sm px-5 py-2.5 disabled:opacity-50"
          >
            {busy ? 'Creando…' : `Crear acceso a los ${pending.length} que faltan`}
          </button>
        </div>

        <p className="text-xs" style={{ color: 'var(--dash-text-faint)' }}>
          {visible.length - pending.length} de {visible.length} ya tienen acceso en este curso.
        </p>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {notice && <p role="status" className="text-sm" style={{ color: 'var(--dash-accent)' }}>{notice}</p>}
      </div>

      {/* Hoja de credenciales para imprimir */}
      {credentials.length > 0 && (
        <section className="dash-card p-5 space-y-3 print:shadow-none">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>
              Credenciales — anótalas o imprímelas ahora
            </h2>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full border border-slate-200 dark:border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 print:hidden"
            >
              Imprimir
            </button>
          </div>
          <p className="text-xs text-amber-600 print:hidden">
            La contraseña no se puede volver a ver después de salir de esta pantalla. Si se pierde, se genera
            una nueva con “Nueva contraseña”.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider" style={{ color: 'var(--dash-text-muted)' }}>
                  <th className="py-2 pr-4 font-bold">Estudiante</th>
                  <th className="py-2 pr-4 font-bold">Código</th>
                  <th className="py-2 font-bold">Contraseña</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((c) => (
                  <tr key={c.studentId} className="border-t" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
                    <td className="py-2 pr-4" style={{ color: 'var(--dash-text)' }}>{c.name}</td>
                    <td className="py-2 pr-4 font-mono font-bold" style={{ color: 'var(--dash-accent)' }}>{c.accessCode}</td>
                    <td className="py-2 font-mono font-bold" style={{ color: 'var(--dash-text)' }}>{c.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Lista del curso */}
      <section className="dash-card p-5 space-y-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>Estudiantes del curso</h2>
        {visible.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>Este curso no tiene estudiantes inscritos.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
            {visible.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--dash-text)' }}>{s.name}</p>
                  {s.hasAccess && s.accessCode && (
                    <p className="text-xs font-mono" style={{ color: 'var(--dash-text-faint)' }}>
                      Código: {s.accessCode}
                    </p>
                  )}
                </div>
                {s.hasAccess ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => resetStudentPassword(s.id))}
                    className="shrink-0 rounded-full border border-slate-200 dark:border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary transition disabled:opacity-50"
                  >
                    Nueva contraseña
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => grantStudentAccess(s.id))}
                    className="shrink-0 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-1.5 transition disabled:opacity-50"
                  >
                    Crear acceso
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
