'use client'

import type { User } from '@supabase/supabase-js'
import { useMobileNav } from './MobileNavContext'
import { canAccess } from '@/lib/permissions'
import GlobalSearch from './GlobalSearch'
import NotificationBell from './NotificationBell'

const roleLabels: Record<string, string> = {
  guardian:     'Portal Familiar',
  teacher:      'Docente',
  director:     'Dirección',
  school_admin: 'Administración',
  finance:      'Tesorería',
  reception:    'Secretaría',
  super_admin:  'Super Admin',
}

// Roles que gestionan estudiantes/familias/facturas -- únicos para los
// que tiene sentido mostrar la búsqueda global (el resto no tiene
// acceso a esos módulos, ver lib/permissions.ts).
const SEARCHABLE_ROLES = ['super_admin', 'school_admin', 'director', 'reception', 'finance']

interface TopBarProps {
  user: User
  role: string
  schoolName: string
  unreadMessagesCount?: number
}

/**
 * TopBar — Barra superior del dashboard.
 * Muestra búsqueda global (roles de gestión), notificaciones, y el
 * usuario con su rol y colegio actual.
 */
export default function TopBar({ user, role, schoolName, unreadMessagesCount = 0 }: TopBarProps) {
  const { toggle } = useMobileNav()
  const displayName = user.user_metadata?.full_name ?? user.email ?? 'Usuario'
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const canSearch = SEARCHABLE_ROLES.includes(role) && (canAccess(role, 'estudiantes') || canAccess(role, 'familias'))

  return (
    <header className="print:hidden flex items-center gap-4 px-4 sm:px-6 py-3.5 border-b border-dash-border bg-dash-bg shrink-0">
      {/* Botón de menú (solo móvil) + eyebrow rol · colegio */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <button
          type="button"
          onClick={toggle}
          aria-label="Abrir menú de navegación"
          className="md:hidden -ml-1.5 p-2 rounded-lg text-dash-text-muted hover:bg-dash-surface transition shrink-0"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <p className="hidden sm:block text-xs font-semibold font-barlow uppercase tracking-[0.14em] text-dash-text-muted truncate">
          {roleLabels[role] ?? 'Portal'} · {schoolName}
        </p>
      </div>

      {/* Búsqueda global -- centrada, solo para roles de gestión */}
      {canSearch && (
        <div className="flex-1 flex justify-center min-w-0">
          <GlobalSearch />
        </div>
      )}
      {!canSearch && <div className="flex-1" />}

      {/* Notificaciones + usuario */}
      <div className="flex items-center gap-3 shrink-0">
        <NotificationBell unreadMessagesCount={unreadMessagesCount} />
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-dash-text leading-tight truncate max-w-[180px]">
            {displayName}
          </p>
          <p className="text-xs text-dash-text-faint">
            {roleLabels[role] ?? role}
          </p>
        </div>
        {/* Avatar con iniciales -- degradado y esquinas redondeadas (no
            círculo), calcado del diseño original */}
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-dash-bg text-sm font-bold font-barlow shrink-0"
          style={{ background: 'linear-gradient(180deg,#34d399,#0b8259)', boxShadow: '0 10px 26px rgba(16,185,129,.35)' }}
          aria-hidden="true"
        >
          {initials}
        </div>
      </div>
    </header>
  )
}
