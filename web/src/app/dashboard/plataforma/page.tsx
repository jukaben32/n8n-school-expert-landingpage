import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { enterSchool } from './actions'

export const metadata: Metadata = {
  title: 'Plataforma — SchoolOS',
  description: 'Todos los colegios de la plataforma.',
}

type SchoolRow = { id: string; name: string; subdomain: string; created_at: string }

/**
 * Plataforma — Solo para super_admin.
 * Lista TODOS los colegios (RLS lo permite vía is_super_admin()),
 * con estudiantes y staff registrados en cada uno.
 */
export default async function PlataformaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    redirect('/dashboard/secretaria')
  }

  const { data: schoolsRaw } = await supabase
    .from('schools')
    .select('id, name, subdomain, created_at')
    .order('created_at', { ascending: false })

  const schools = (schoolsRaw ?? []) as SchoolRow[]

  // Conteos por colegio (una consulta por colegio; la plataforma normalmente
  // maneja pocos colegios, así que esto es aceptable para el MVP)
  const counts = await Promise.all(
    schools.map(async (school) => {
      const [{ count: students }, { count: staffCount }] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', school.id),
        supabase.from('staff').select('id', { count: 'exact', head: true }).eq('school_id', school.id),
      ])
      return { schoolId: school.id, students: students ?? 0, staff: staffCount ?? 0 }
    })
  )
  const countsBySchool = new Map(counts.map((c) => [c.schoolId, c]))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Plataforma
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {schools.length} colegio{schools.length !== 1 ? 's' : ''} en SchoolOS
          </p>
        </div>
        <Link
          href="/dashboard/plataforma/nuevo"
          className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 transition shadow-glow"
        >
          + Nuevo colegio
        </Link>
      </div>

      {schools.length > 0 ? (
        <div className="grid gap-3">
          {schools.map((school) => {
            const c = countsBySchool.get(school.id)
            return (
              <div
                key={school.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">{school.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">/{school.subdomain}</p>
                </div>
                <div className="flex gap-4 shrink-0 items-center">
                  <div className="text-center">
                    <p className="text-lg font-black text-primary dark:text-accent-light">{c?.students ?? 0}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Estudiantes</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-primary dark:text-accent-light">{c?.staff ?? 0}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Staff</p>
                  </div>
                  <form action={enterSchool.bind(null, school.id)}>
                    <button
                      type="submit"
                      className="rounded-full border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition whitespace-nowrap"
                    >
                      Entrar como director
                    </button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">🏫</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Aún no hay colegios registrados.</p>
        </div>
      )}
    </div>
  )
}
