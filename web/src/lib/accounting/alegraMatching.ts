import type { AlegraInvoice } from './alegraClient'

/**
 * Núcleo de emparejamiento de la conciliación con Alegra.
 *
 * A propósito NO importa Supabase ni nada de Next.js: son funciones puras
 * sobre datos ya traídos. Así se pueden probar de verdad con los casos
 * reales que rompieron la conciliación a mano del 2026-09-09 (nombres con
 * espacio al final, doble espacio, ñ, guiones, mayúsculas), en vez de
 * confiar en que "se ve bien". Mismo criterio que
 * `answerFamilyQuestion.ts`: el núcleo no sabe de sesión ni de base.
 */

export type MatchReason = 'sin_emparejar' | 'ambiguo' | 'aproximado' | 'posible_duplicado' | 'conjunto'

export interface StudentRow {
  id: string
  first_name: string
  last_name: string
  student_code: string | null
  family_id: string
  grade_level: string | null
}

export interface GuardianRow {
  family_id: string
  first_name: string | null
  last_name: string | null
  national_id: string | null
}

export interface Candidate {
  studentId: string
  name: string
  gradeLevel: string | null
  via: 'matricula' | 'nombre' | 'nombre_aproximado' | 'cedula_tutor'
}

/** Conceptos de Alegra que sí bajan la deuda de mensualidad. */
const CONCEPTOS_MENSUALIDAD = ['mensualidad', 'abono', 'colegiatura']

/**
 * Normaliza un nombre para comparar: minúsculas, sin acentos, sin
 * puntuación, espacios colapsados y recortados.
 *
 * El `trim` final NO es decorativo: Alegra tiene nombres con espacio al
 * final ("Teylor Andrian Diaz Mota ") y con doble espacio en el medio
 * ("Dhanel Elian  Leonardo Mercedes"). Sin normalizar así, esas filas no
 * emparejan y el cobro se pierde en la bandeja sin motivo real.
 */
export function normalizeName(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Solo dígitos -- las cédulas vienen con y sin guiones según quién las tecleó. */
function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/**
 * Distancia de edición (Levenshtein) entre dos palabras.
 *
 * Existe por los cuatro descuadres REALES del 2026-09-09 entre cómo escribe
 * Alegra y cómo escribe la plataforma: Olivarez/Olivares, Morale/Morales,
 * Andrian/Adrian, Sara/Sarha. Todos son de una sola letra. Sin tolerancia,
 * esos cobros llegan a la bandeja sin ningún candidato sugerido y hay que
 * buscarlos a mano, que es lo que pasó esa vez.
 *
 * Se usa SOLO para sugerir candidatos a quien revisa -- jamás para cargar
 * un cobro solo.
 */
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0]
    fila[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = fila[j]
      fila[j] = Math.min(
        fila[j] + 1,
        fila[j - 1] + 1,
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      anterior = temp
    }
  }
  return fila[b.length]
}

/** Dos palabras "son la misma" si difieren en una letra (dos si son largas). */
function palabraSeParece(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 2) return false
  const tolerancia = Math.max(a.length, b.length) >= 7 ? 2 : 1
  return editDistance(a, b) <= tolerancia
}

/**
 * Cuánto de esta factura de Alegra corresponde a mensualidad.
 * Libros, Uniformes y Recargo por Mora se excluyen a propósito: no son
 * cuota, así que no deben descontar deuda de mensualidad.
 */
export function mensualidadAmount(invoice: AlegraInvoice): number {
  const total = invoice.items
    .filter((item) => {
      const name = normalizeName(item.name)
      return CONCEPTOS_MENSUALIDAD.some((c) => name.includes(c))
    })
    .reduce((sum, item) => sum + (Number.isFinite(item.total) ? item.total : 0), 0)
  return Math.round(total * 100) / 100
}

/**
 * Empareja una factura de Alegra con un estudiante.
 *
 * Orden de preferencia, de más confiable a menos:
 *   1. Matrícula (`client.identification` de tipo IE) -- estable, sin
 *      acentos ni erratas. Es la razón por la que vale la pena poblar
 *      `students.student_code`.
 *   2. Nombre exacto normalizado.
 *   3. Cédula del tutor (tipo CED) -- el comprobante fiscal conjunto va a
 *      nombre del padre/madre, nunca del menor. Si la familia tiene un
 *      solo inscrito es inequívoco; con varios, es un e-CF conjunto y hay
 *      que repartirlo a mano.
 *   4. Nombre aproximado (todas las palabras de Alegra aparecen en el
 *      nombre del estudiante) -- se REPORTA pero nunca se carga solo.
 */
export function matchInvoice(
  invoice: AlegraInvoice,
  students: StudentRow[],
  guardians: GuardianRow[]
): { candidates: Candidate[]; auto: Candidate | null; reason: MatchReason | null } {
  const idType = (invoice.clientIdentificationType ?? '').toUpperCase()
  const identification = (invoice.clientIdentification ?? '').trim()
  const clientName = normalizeName(invoice.clientName)

  const asCandidate = (s: StudentRow, via: Candidate['via']): Candidate => ({
    studentId: s.id,
    name: `${s.first_name} ${s.last_name}`.trim(),
    gradeLevel: s.grade_level,
    via,
  })

  // 1. Matrícula
  if (idType === 'IE' && identification) {
    const byCode = students.filter((s) => (s.student_code ?? '').trim().toLowerCase() === identification.toLowerCase())
    if (byCode.length === 1) {
      return { candidates: [asCandidate(byCode[0], 'matricula')], auto: asCandidate(byCode[0], 'matricula'), reason: null }
    }
    if (byCode.length > 1) {
      return { candidates: byCode.map((s) => asCandidate(s, 'matricula')), auto: null, reason: 'ambiguo' }
    }
    // Sin matrícula cargada todavía -- sigue por nombre, no falla.
  }

  // 2. Nombre exacto
  if (clientName) {
    const exact = students.filter((s) => normalizeName(`${s.first_name} ${s.last_name}`) === clientName)
    if (exact.length === 1) {
      return { candidates: [asCandidate(exact[0], 'nombre')], auto: asCandidate(exact[0], 'nombre'), reason: null }
    }
    if (exact.length > 1) {
      return { candidates: exact.map((s) => asCandidate(s, 'nombre')), auto: null, reason: 'ambiguo' }
    }
  }

  // 3. Cédula del tutor (comprobante fiscal a nombre del padre/madre)
  if (idType === 'CED' && onlyDigits(identification)) {
    const cedula = onlyDigits(identification)
    const familyIds = new Set(
      guardians.filter((g) => onlyDigits(g.national_id) === cedula).map((g) => g.family_id)
    )
    if (familyIds.size > 0) {
      const hijos = students.filter((s) => familyIds.has(s.family_id))
      if (hijos.length === 1) {
        return { candidates: [asCandidate(hijos[0], 'cedula_tutor')], auto: asCandidate(hijos[0], 'cedula_tutor'), reason: null }
      }
      if (hijos.length > 1) {
        // e-CF conjunto: cubre a varios hermanos y hay que repartirlo.
        return { candidates: hijos.map((s) => asCandidate(s, 'cedula_tutor')), auto: null, reason: 'conjunto' }
      }
    }
  }

  // 4. Nombre aproximado -- se REPORTA como sugerencia, nunca se carga solo.
  //    Tolera una letra de diferencia por palabra: los cuatro descuadres
  //    reales de la conciliación a mano eran exactamente eso.
  if (clientName) {
    const palabras = clientName.split(' ').filter((w) => w.length > 2)
    if (palabras.length >= 2) {
      const puntuados = students
        .map((s) => {
          const suyas = normalizeName(`${s.first_name} ${s.last_name}`).split(' ').filter(Boolean)
          const aciertos = palabras.filter((w) => suyas.some((p) => palabraSeParece(w, p))).length
          return { student: s, aciertos }
        })
        .filter((x) => x.aciertos >= 2 && x.aciertos >= Math.ceil(palabras.length / 2))
        .sort((a, b) => b.aciertos - a.aciertos)
      if (puntuados.length > 0) {
        const mejorPuntaje = puntuados[0].aciertos
        const candidatos = puntuados
          .filter((x) => x.aciertos === mejorPuntaje)
          .slice(0, 5)
          .map((x) => asCandidate(x.student, 'nombre_aproximado'))
        return { candidates: candidatos, auto: null, reason: 'aproximado' }
      }
    }
  }

  return { candidates: [], auto: null, reason: 'sin_emparejar' }
}
