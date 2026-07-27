type QueryErrorItem = { label: string; error: { message: string } | null }

/**
 * QueryErrorBanner — muestra en rojo cualquier error real de una consulta
 * a Supabase, en vez de dejar que la página se vea simplemente "vacía"
 * sin explicar por qué. Se le pasan uno o varios { label, error } y solo
 * renderiza los que de verdad tengan un error.
 *
 * Uso:
 *   <QueryErrorBanner errors={[
 *     { label: 'estudiantes', error: studentsError },
 *     { label: 'familias', error: familiesError },
 *   ]} />
 */
export default function QueryErrorBanner({
  errors,
}: {
  errors: QueryErrorItem[]
}) {
  const failed = errors.filter((e): e is { label: string; error: { message: string } } => !!e.error)
  if (failed.length === 0) return null

  return (
    <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 space-y-1">
      {failed.map((f) => (
        <p key={f.label}>
          <span className="font-semibold">No se pudo cargar &quot;{f.label}&quot;.</span>{' '}
          <span className="font-mono text-xs">{f.error.message}</span>
        </p>
      ))}
    </div>
  )
}
