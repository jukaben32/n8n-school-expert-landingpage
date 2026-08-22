import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/dashboard/Sidebar'
import TopBar from '@/components/dashboard/TopBar'
import { MobileNavProvider } from '@/components/dashboard/MobileNavContext'
import { getActiveSchool } from '@/lib/activeSchool'
import { exitSchoolView } from './plataforma/actions'

/**
 * Layout del Dashboard — MentorIApp
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
    .select('role, school_id, guardian_id')
    .eq('auth_id', user.id)
    .single()

  const role = profile?.role ?? 'guardian'
  const { schoolId, isViewingOtherSchool, schoolName: overrideSchoolName } = await getActiveSchool(role, profile?.school_id ?? '')

  // Leads nuevos sin atender, solo relevante para el súper administrador
  let newLeadsCount = 0
  if (role === 'super_admin') {
    const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'nuevo')
    newLeadsCount = count ?? 0
  }

  // Mensajes directos sin leer (de tutores hacia el staff) -- no se puede
  // filtrar "created_at > staff_last_read_at" por fila con un solo count()
  // de supabase-js, así que se trae lo mínimo y se cuenta en JS. Escala
  // muy poco (una fila por familia con conversación activa).
  let newMessagesCount = 0
  if (['super_admin', 'school_admin', 'director', 'teacher', 'reception'].includes(role) && schoolId) {
    const { data: convRows } = await supabase
      .from('direct_conversations')
      .select('id, staff_last_read_at, direct_messages(sender_type, created_at)')
      .eq('school_id', schoolId)
    type Row = { staff_last_read_at: string | null; direct_messages: { sender_type: string; created_at: string }[] }
    for (const c of (convRows ?? []) as unknown as Row[]) {
      newMessagesCount += c.direct_messages.filter(
        (m) => m.sender_type === 'guardian' && (!c.staff_last_read_at || m.created_at > c.staff_last_read_at)
      ).length
    }
  }

  // Obtener el nombre del colegio en una consulta separada si tenemos school_id
  let schoolName = overrideSchoolName ?? 'Mi Colegio'
  if (!overrideSchoolName && schoolId) {
    const { data: school } = await supabase
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .single()
    if (school?.name) schoolName = school.name
  }

  return (
    <MobileNavProvider>
      {/* "dark" fija el tema oscuro del dashboard interno independientemente
          de la preferencia del sistema operativo (ver globals.css:
          @custom-variant dark). El resto de la app (login, landing) no
          lleva esta clase, así que no le afecta. */}
      <div className="dark flex h-screen bg-dash-bg overflow-hidden">
        {/* Sidebar de navegación lateral -- cajón deslizable en móvil, fijo en escritorio */}
        <Sidebar
          role={isViewingOtherSchool ? 'director' : role}
          schoolName={schoolName}
          newLeadsCount={newLeadsCount}
          newMessagesCount={newMessagesCount}
          guardianId={role !== 'guardian' ? profile?.guardian_id ?? null : null}
        />

        {/* Área principal */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          {isViewingOtherSchool && (
            <div className="flex items-center justify-between gap-3 bg-amber-900/20 border-b border-amber-800 px-4 sm:px-6 py-2 text-sm">
              <span className="text-amber-300 font-medium">
                👁️ Estás viendo <strong className="font-bold">{schoolName}</strong> como director — súper administrador
              </span>
              <form action={exitSchoolView}>
                <button type="submit" className="text-amber-300 font-semibold underline underline-offset-2 hover:no-underline shrink-0">
                  Volver a Plataforma
                </button>
              </form>
            </div>
          )}
          <TopBar user={user} role={role} schoolName={schoolName} unreadMessagesCount={newMessagesCount} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </MobileNavProvider>
  )
}
