import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/dashboard/Sidebar'
import TopBar from '@/components/dashboard/TopBar'

/**
 * Layout del Dashboard — SchoolOS
 * Protege todas las rutas /dashboard/* exigiendo sesión activa.
 * Detecta el rol del usuario y pasa el contexto al resto de la UI.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Si no hay sesión, redirigir al login
  if (!user) redirect('/login')

  // Obtener el perfil del usuario (rol y school_id) — sin join para evitar problemas de tipos
  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  // Obtener el nombre del colegio en una consulta separada si tenemos school_id
  let schoolName = 'Mi Colegio'
  if (profile?.school_id) {
    const { data: school } = await supabase
      .from('schools')
      .select('name')
      .eq('id', profile.school_id)
      .single()
    if (school?.name) schoolName = school.name
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar de navegación lateral */}
      <Sidebar role={profile?.role ?? 'guardian'} schoolName={schoolName} />

      {/* Área principal */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar user={user} role={profile?.role ?? 'guardian'} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
