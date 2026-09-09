import { gradeLevelToCategory, type SchoolLevel } from './gradeLevelCategory'

/**
 * Ordena cursos como los diría una persona del colegio: Párvulos, Inicial,
 * 1ro..6to de Primaria, 1ro..6to de Secundaria.
 *
 * Existe porque ordenar `students.grade_level` alfabéticamente los intercala
 * ("1ro. Primaria", "1ro. Secundaria", "2do. Primaria"...), que es peor que no
 * ordenar. Vive aquí y no dentro de un componente para poder probarse sin
 * React, igual que `gradeLevelCategory.ts`.
 *
 * El ordinal se saca del texto libre, que en producción trae variantes reales
 * ("6to Secundaria" sin punto, "3r0. Primaria"). Un curso sin número (Kinder,
 * Párvulo) queda en 0 y se desempata alfabéticamente dentro de su nivel.
 */
const ORDEN_NIVEL: Record<SchoolLevel, number> = {
  parvulo: 0,
  inicial: 1,
  primaria: 2,
  secundaria: 3,
}

/** Nivel desconocido: al final, nunca escondido. */
const NIVEL_DESCONOCIDO = 9

export function compareGradeLevels(a: string, b: string): number {
  const nivelA = gradeLevelToCategory(a)
  const nivelB = gradeLevelToCategory(b)
  const rangoA = nivelA ? ORDEN_NIVEL[nivelA] : NIVEL_DESCONOCIDO
  const rangoB = nivelB ? ORDEN_NIVEL[nivelB] : NIVEL_DESCONOCIDO
  if (rangoA !== rangoB) return rangoA - rangoB

  const ordinalA = Number(a.trim().match(/^(\d+)/)?.[1] ?? 0)
  const ordinalB = Number(b.trim().match(/^(\d+)/)?.[1] ?? 0)
  if (ordinalA !== ordinalB) return ordinalA - ordinalB

  return a.localeCompare(b, 'es')
}
