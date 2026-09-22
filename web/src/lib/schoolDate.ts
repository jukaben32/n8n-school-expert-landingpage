const SCHOOL_TIME_ZONE = 'America/Santo_Domingo'

/**
 * Convierte cualquier instante a su fecha de calendario en la zona horaria
 * del colegio (UTC-4 todo el año, sin horario de verano), en formato
 * YYYY-MM-DD.
 *
 * NUNCA usar `d.toISOString().split('T')[0]` para esto -- ese calcula la
 * fecha en UTC, que ya es el día siguiente entre las 8pm y medianoche hora
 * de RD (bug real: la página de Asistencia mostraba "viernes 21" cuando
 * todavía era jueves 20 de noche en el colegio; el mismo patrón se coló
 * después en el Panel -- ver `secretaria/page.tsx` -- y por eso la tarjeta
 * de Asistencia del Panel mostraba "Sin datos previos" aunque sí había
 * asistencia registrada, en la misma ventana horaria).
 */
export function schoolDateString(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: SCHOOL_TIME_ZONE })
}

/** Fecha de "hoy" en la zona horaria del colegio. Ver `schoolDateString`. */
export function todaySchoolDate(): string {
  return schoolDateString(new Date())
}

const WEEKDAY_TO_DOW: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }

/**
 * Día de la semana de "hoy" en la zona horaria del colegio, en el mismo
 * formato que `class_schedules.day_of_week` (1=lunes ... 6=sábado).
 * Domingo devuelve 0 -- no hay franjas ese día, así que "hoy" simplemente
 * no calza con ninguna (quien lo use decide qué mostrar por defecto).
 *
 * Mismo motivo que `todaySchoolDate()`: calcular "hoy" con la hora del
 * servidor (usualmente UTC en Vercel) corre el día entre las 8pm y
 * medianoche hora de RD.
 */
export function todaySchoolDayOfWeek(): number {
  const label = new Date().toLocaleDateString('en-US', { timeZone: SCHOOL_TIME_ZONE, weekday: 'short' })
  return WEEKDAY_TO_DOW[label] ?? 1
}
