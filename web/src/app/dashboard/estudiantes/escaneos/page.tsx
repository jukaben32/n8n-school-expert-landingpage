import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { listPendingEnrollmentScans } from './actions'
import EnrollmentScansReview from './EnrollmentScansReview'

export const metadata: Metadata = {
  title: 'Escanear fichas de inscripción — SchoolOS',
}

/**
 * Bandeja de escaneo de fichas físicas de inscripción -- URGENTE (inicio de
 * clases en ~2 semanas). Sube fotos/PDFs de fichas ya llenas a mano, Claude
 * extrae los campos, y el staff revisa/corrige antes de confirmar. Solo al
 * confirmar se crea el estudiante -- ver AGENTS.md.
 */
export default async function EnrollmentScansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')

  if (!profile || !canAccess(profile.role, 'estudiantes_escaneos')) {
    redirect('/dashboard/estudiantes')
  }

  const scans = await listPendingEnrollmentScans()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Escanear fichas de inscripción
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Sube fotos de las fichas físicas (una por estudiante) o un solo PDF con varias fichas escaneadas de corrido.
          El sistema lee los datos automáticamente -- revísalos y corrígelos antes de confirmar. No se crea ningún
          estudiante hasta que confirmes cada ficha.
        </p>
      </div>

      <EnrollmentScansReview initialScans={scans} />
    </div>
  )
}
