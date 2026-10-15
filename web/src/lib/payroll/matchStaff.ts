// Sugiere a qué ficha de personal corresponde un nombre de la hoja de Excel
// ("Calderon A., Ana Danelia" vs. staff "Ana Danelia" "Calderon"). Solo
// SUGIERE: Dirección confirma una vez y queda guardado en payslip_staff_map.

const STOP = new Set(['de', 'la', 'del', 'los', 'las', 'y', 'e'])

function tokens(s: string): Set<string> {
  return new Set(
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z ]/g, ' ').split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t)),
  )
}

export function suggestStaffId(excelName: string, staff: { id: string; name: string }[]): string | null {
  const target = tokens(excelName)
  if (target.size === 0) return null
  let best: { id: string; score: number } | null = null
  let tie = false
  for (const s of staff) {
    const t = tokens(s.name)
    let common = 0
    for (const w of t) if (target.has(w)) common++
    // Debe coincidir al menos el 75% del nombre más corto (tolera una errata, ej.
    // Tejada/Tejeda) y nunca menos de 2 palabras. Es solo una SUGERENCIA.
    const need = Math.max(2, Math.ceil(Math.min(t.size, target.size) * 0.75))
    if (common < need) continue
    if (!best || common > best.score) { best = { id: s.id, score: common }; tie = false }
    else if (common === best.score) tie = true
  }
  return best && !tie ? best.id : null
}
