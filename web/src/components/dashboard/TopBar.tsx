'use client'

import type { User } from '@supabase/supabase-js'
import { useMobileNav } from './MobileNavContext'

const roleLabels: Record<string, string> = {
  guardian:     'Portal Familiar',
  teacher:      'Docente',
  director:     'Dirección',
  school_admin: 'Administración',
  finance:      'Tesorería',
  reception:    'Secretaría',
  super_admin:  'Super Admin',
}

interface TopBarProps {
  user: User
  role: string
}

/**
 * TopBar — Barra superior del dashboard.
 * Muestra el nombre/email del usuario y su rol actual.
 */
export default function TopBar({ user, role }: TopBarProps) {
  const { toggle } = useMobileNav()
  const displayName = user.user_metadata?.full_name ?? user.email ?? 'Usuario'
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="print:hidden flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
      {/* Sección izquierda: botón de menú (solo móvil) + breadcrumb / título */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={toggle}
          aria-label="Abrir menú de navegación"
          className="md:hidden -ml-1.5 p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 truncate">
          {roleLabels[role] ?? 'Portal'}
        </p>
      </div>

      {/* Sección derecha: avatar del usuario */}
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-tight truncate max-w-[180px]">
            {displayName}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {roleLabels[role] ?? role}
          </p>
        </div>
        {/* Avatar con iniciales */}
        <div
          className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0"
          aria-hidden="true"
        >
          {initials}
        </div>
      </div>
    </header>
  )
}
