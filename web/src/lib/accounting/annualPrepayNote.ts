/**
 * ¿La nota de un cobro dice que es el año escolar completo (o hasta junio)?
 *
 * Función PURA, sin imports (se prueba con node:
 * scripts/test-annual-prepay-note.mjs). Notas reales de Alegra que deben
 * reconocerse (2026-08/11): "AGO-JUN", "10.5 meses y mora de agosto",
 * "10.5 Mese pago, con el descuento aplicado.", "Pago del año completo
 * para ...", "Pago año completo (Noviembre 2026 a Junio 2027) con
 * descuento". Y que NO deben: "AGO-ENE", "Mes de agosto", "abono a sep",
 * "MES DE JUNIO" (la cuota de junio sola, sin rango).
 *
 * Solo dice "parece un pago anual". Quién recibe el crédito y cuánto lo
 * decide applyAnnualPrepayCredit con los números reales del estudiante.
 */
export function looksLikeAnnualPrepayment(note: string | null | undefined): boolean {
  if (!note) return false
  const t = note
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')

  if (/\b(ano|anio) (escolar )?completo\b/.test(t)) return true
  if (/\btodo el (ano|anio)\b/.test(t)) return true
  if (/\banual(idad)?\b/.test(t)) return true
  if (/\b10[.,]5\s*mes/.test(t)) return true
  // Un rango que termina en junio: "ago-jun", "sep a junio", "hasta jun".
  if (/\b[a-z0-9]{3,10}\.?\s*(-|–|a|al|hasta)\s*jun(io)?\b/.test(t) && !/\bmes de jun(io)?\b/.test(t)) return true
  if (/\bhasta jun(io)?\b/.test(t)) return true
  return false
}
