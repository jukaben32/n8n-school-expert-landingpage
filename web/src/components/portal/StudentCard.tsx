const statusLabels: Record<string, { text: string; color: string }> = {
  inscrito:   { text: 'Inscrito',   color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  admitido:   { text: 'Admitido',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  prospecto:  { text: 'Prospecto',  color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  solicitud:  { text: 'Solicitud',  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  evaluacion: { text: 'Evaluación', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  retirado:   { text: 'Retirado',   color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
}

interface StudentCardProps {
  id: string
  firstName: string
  lastName: string
  photoUrl: string | null
  enrollmentStatus: string
  relationship: string
}

/**
 * StudentCard — Tarjeta de estudiante para el portal familiar.
 */
export default function StudentCard({
  id, firstName, lastName, photoUrl, enrollmentStatus, relationship
}: StudentCardProps) {
  const status = statusLabels[enrollmentStatus] ?? { text: enrollmentStatus, color: 'bg-slate-100 text-slate-600' }
  const initials = `${firstName[0]}${lastName[0]}`.toUpperCase()

  return (
    <a
      href={`/dashboard/estudiantes/${id}`}
      id={`student-card-${id}`}
      className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/30 dark:hover:border-accent/30 hover:shadow-soft transition group"
    >
      {/* Avatar / Foto */}
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={`${firstName} ${lastName}`}
          className="w-12 h-12 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-primary/10 dark:bg-accent/10 flex items-center justify-center text-primary dark:text-accent-light font-bold text-lg shrink-0">
          {initials}
        </div>
      )}

      {/* Información */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 dark:text-white truncate">
          {firstName} {lastName}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
          {relationship}
        </p>
      </div>

      {/* Estado de inscripción */}
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${status.color}`}>
        {status.text}
      </span>

      {/* Flecha */}
      <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary dark:group-hover:text-accent transition shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </a>
  )
}
