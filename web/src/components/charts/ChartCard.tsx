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
    <div className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
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
      <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs">{message}</p>
    </div>
  )
}
