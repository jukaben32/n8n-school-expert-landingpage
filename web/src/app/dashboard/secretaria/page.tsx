import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/permissions'

export const metadata: Metadata = {
  title: 'Secretaría — SchoolOS',
  description: 'Panel de gestión escolar para el equipo administrativo.',
}

/**
 * Portal de Secretaría — Vista principal para administradores, dirección y recepción.
 * Muestra: métricas rápidas (total estudiantes, comunicados pendientes, pagos).
 */
export default async function SecretariaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Obtener el school_id del perfil
  const { data: profile } = await supabase
    .from('users_profiles')
    .select('school_id, role')
    .eq('auth_id', user.id)
    .single()

  if (profile && !canAccess(profile.role, 'secretaria')) {
    redirect('/dashboard')
  }

  // Rango del mes en curso, para el conteo de comunicados publicados
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Métricas básicas
  const [
    { count: totalStudents },
    { count: totalFamilies },
    { count: messagesThisMonth },
    { count: pendingInvoices },
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', profile?.school_id ?? ''),
    supabase.from('families').select('*', { count: 'exact', head: true }).eq('school_id', profile?.school_id ?? ''),
    supabase.from('messages').select('*', { count: 'exact', head: true })
      .eq('school_id', profile?.school_id ?? '')
      .gte('published_at', startOfMonth)
      .not('published_at', 'is', null),
    supabase.from('invoices').select('*', { count: 'exact', head: true })
      .eq('school_id', profile?.school_id ?? '')
      .in('status', ['pendiente', 'vencido']),
  ])

  const metrics = [
    { label: 'Estudiantes inscritos', value: totalStudents ?? 0, icon: '🎒', color: 'text-primary dark:text-accent-light' },
    { label: 'Familias registradas',  value: totalFamilies ?? 0, icon: '👨‍👩‍👧', color: 'text-primary dark:text-accent-light' },
    { label: 'Comunicados este mes',  value: messagesThisMonth ?? 0, icon: '📬', color: 'text-primary dark:text-accent-light' },
    { label: 'Pagos pendientes',      value: pendingInvoices ?? 0, icon: '💳', color: 'text-primary dark:text-accent-light' },
  ]

  return (
    <div className="space-y-8">

      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Panel de Secretaría
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Vista general del colegio
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
          >
            <p className="text-2xl mb-2" aria-hidden="true">{m.icon}</p>
            <p className={`text-3xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Acciones rápidas */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { href: '/dashboard/estudiantes/nuevo', label: 'Nuevo Estudiante', icon: '➕' },
            { href: '/dashboard/comunicados/nuevo', label: 'Nuevo Comunicado', icon: '📝' },
            { href: '/dashboard/familias',           label: 'Ver Familias',     icon: '👨‍👩‍👧' },
            { href: '/dashboard/asistencia',         label: 'Registrar Asistencia', icon: '📅' },
            { href: '/dashboard/pagos',              label: 'Ver Pagos',        icon: '💳' },
            { href: '/dashboard/reportes',           label: 'Reportes',         icon: '📊' },
          ].map((action) => (
            <a
              key={action.href}
              href={action.href}
              id={`action-${action.label.toLowerCase().replace(/\s/g, '-')}`}
              className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/30 dark:hover:border-accent/30 hover:shadow-soft transition group"
            >
              <span className="text-xl" aria-hidden="true">{action.icon}</span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary dark:group-hover:text-accent-light transition">
                {action.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
