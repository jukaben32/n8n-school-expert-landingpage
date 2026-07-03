interface SummaryBadgeProps {
  label: string
  value: string
  icon: string
  href: string
}

/**
 * SummaryBadge — Acceso rápido en el portal familiar
 * (Comunicados, Pagos, Asistencia).
 */
export default function SummaryBadge({ label, icon, href }: SummaryBadgeProps) {
  return (
    <a
      href={href}
      id={`summary-badge-${label.toLowerCase()}`}
      className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/30 dark:hover:border-accent/30 hover:shadow-soft transition text-center group"
    >
      <span className="text-2xl" aria-hidden="true">{icon}</span>
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 group-hover:text-primary dark:group-hover:text-accent-light transition">
        {label}
      </span>
    </a>
  )
}
