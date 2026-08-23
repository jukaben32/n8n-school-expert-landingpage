export default function ChartCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`dash-card p-5 sm:p-6 space-y-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold font-barlow uppercase tracking-widest" style={{ color: 'var(--dash-text-muted)' }}>{title}</h3>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--dash-text-faint)' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-center">
      <p className="text-sm max-w-xs" style={{ color: 'var(--dash-text-faint)' }}>{message}</p>
    </div>
  )
}
