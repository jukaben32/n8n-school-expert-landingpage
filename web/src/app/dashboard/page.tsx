import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Dashboard Home — Redirige según el rol del usuario:
 * - guardian    → /dashboard/portal-familiar
 * - student     → /dashboard/academia
 * - teacher     → /dashboard/asistencia
 * - director / school_admin / finance / reception → /dashboard/secretaria
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  const role = profile?.role ?? 'guardian'

  // Redirección según el rol
  const roleRoutes: Record<string, string> = {
    guardian:     '/dashboard/portal-familiar',
    student:      '/dashboard/academia',
    teacher:      '/dashboard/asistencia',
    director:     '/dashboard/secretaria',
    school_admin: '/dashboard/secretaria',
    finance:      '/dashboard/tesoreria',
    reception:    '/dashboard/estudiantes',
    super_admin:  '/dashboard/plataforma',
  }

  redirect(roleRoutes[role] ?? '/dashboard/portal-familiar')
}
