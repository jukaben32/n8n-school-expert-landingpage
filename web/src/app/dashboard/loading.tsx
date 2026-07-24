/**
 * Loading state — se muestra automáticamente mientras cualquier página
 * bajo /dashboard/* espera su fetch de datos en el servidor.
 */
export default function DashboardLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-64 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800/60" />
        ))}
      </div>
      <div className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800/60" />
    </div>
  )
}
