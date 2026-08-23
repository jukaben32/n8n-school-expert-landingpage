/**
 * Traduce el texto libre de `students.grade_level` (ej. "1ro. Secundaria",
 * "Pre Primario", "Kinder") al nivel del colegio, usando el mismo vocabulario
 * que `grade_levels.category` y `class_periods.level`.
 *
 * Existe porque `grade_level` es texto libre escrito a mano por el staff, con
 * variantes reales ya vistas en producción: "1ro. Secundaria" y "6to
 * Secundaria" (sin punto), "1ro de Secundaria", "3r0. Primaria". Cualquier
 * comparación exacta contra un catálogo fallaría; lo que sí es estable es la
 * palabra del nivel dentro del texto.
 */
export type SchoolLevel = 'parvulo' | 'inicial' | 'primaria' | 'secundaria'

/**
 * Quita tildes y pasa a minúsculas. Se hace con NFD (que separa la letra de
 * su tilde) y descartando los diacríticos combinantes por código, en vez de
 * escribirlos literalmente en una expresión regular -- son invisibles en el
 * editor y se corrompen con facilidad al copiar el archivo.
 */
function normalize(value: string): string {
  return Array.from(value.normalize('NFD'))
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0
      return code < 0x0300 || code > 0x036f
    })
    .join('')
    .toLowerCase()
}

/**
 * Devuelve el nivel al que pertenece un curso, o `null` si no se reconoce
 * (en ese caso conviene no filtrar nada, en vez de esconder franjas).
 *
 * El orden de las comprobaciones importa: "Pre Primario" contiene "primari"
 * pero es nivel inicial, no primaria, así que se descarta antes.
 */
export function gradeLevelToCategory(gradeLevel: string | null | undefined): SchoolLevel | null {
  if (!gradeLevel) return null

  const text = normalize(gradeLevel)

  if (text.includes('parvulo')) return 'parvulo'

  // Inicial: nombres propios del nivel, no ordinales. "Pre primario" va aquí
  // (y debe evaluarse antes que "primaria" para no caer en el nivel primario).
  if (text.includes('kinder') || /pre[\s-]*primario/.test(text) || text.includes('inicial')) {
    return 'inicial'
  }

  if (text.includes('secundaria') || text.includes('secundario')) return 'secundaria'
  if (text.includes('primaria') || text.includes('primario')) return 'primaria'

  return null
}

/**
 * Filtra las franjas horarias que corresponden a un curso. Una franja sin
 * nivel (`level === null`) aplica a todos los cursos, así que siempre entra;
 * y si el curso no se pudo clasificar, se devuelven todas para no dejar la
 * pantalla vacía.
 */
export function periodsForGrade<T extends { level?: string | null }>(
  periods: T[],
  gradeLevel: string | null | undefined
): T[] {
  const category = gradeLevelToCategory(gradeLevel)
  if (!category) return periods
  return periods.filter((p) => !p.level || p.level === category)
}
