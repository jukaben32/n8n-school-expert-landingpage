const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * "ago2026" -- 3 primeras letras del mes en español (minúsculas) + año.
 * Mismo patrón que ya usa `calculate_receivable_status()` en SQL para
 * identificar la cuota vencida; se porta aquí para el recargo (Rec-ago2026),
 * que se etiqueta con el mes en que se genera, no con el de la cuota vieja.
 */
export function spanishMonthYearReference(date: Date): string {
  return `${MONTHS_ES[date.getMonth()]}${date.getFullYear()}`
}

export function lateFeeReference(date: Date): string {
  return `Rec-${spanishMonthYearReference(date)}`
}
