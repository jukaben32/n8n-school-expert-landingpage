const SCHOOL_TIME_ZONE = 'America/Santo_Domingo'

/**
 * Fecha de "hoy" en la zona horaria del colegio (UTC-4 todo el año, sin
 * horario de verano), en formato YYYY-MM-DD.
 *
 * NUNCA usar `new Date().toISOString().split('T')[0]` para esto -- ese
 * calcula "hoy" en UTC, que ya es el día siguiente entre las 8pm y
 * medianoche hora de RD (bug real: la página de Asistencia mostraba
 * "viernes 21" cuando todavía era jueves 20 de noche en el colegio).
 */
export function todaySchoolDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: SCHOOL_TIME_ZONE })
}
