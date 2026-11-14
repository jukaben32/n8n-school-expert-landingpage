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

export type MatchReason = 'sin_emparejar' | 'ambiguo' | 'aproximado' | 'posible_duplicado' | 'conjunto' | 'nota_distinta'

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
  via: 'matricula' | 'nombre' | 'nombre_aproximado' | 'cedula_tutor' | 'nota' | 'matricula_nota'
  /** La nota de la factura en Alegra nombra a este estudiante. */
  namedInNote?: boolean
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
export function palabraSeParece(a: string, b: string): boolean {
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
export interface MatchResult {
  candidates: Candidate[]
  auto: Candidate | null
  reason: MatchReason | null
  /**
   * Cobro de varios hermanos que se puede repartir SOLO si el monto cuadra
   * exacto con sus cuotas (`splitByTuition`). Si no cuadra, va a la bandeja
   * con `reason` ('conjunto').
   */
  splitIds?: string[]
}

/** Matrículas escritas en la nota de Alegra ("24-0033, 24-0034"). */
export function matriculasEnNota(note: string | null | undefined): string[] {
  const found = (note ?? '').match(/\b\d{2}-\d{3,5}\b/g) ?? []
  return [...new Set(found.map((c) => c.toLowerCase()))]
}

/**
 * Atribuye un cobro de comprobante conjunto (o con varias matrículas en la
 * nota) a los hermanos SOLO si hay UNA ÚNICA forma de que cuadre exacto.
 *
 * Se prueban todas las combinaciones de hermanos: una combinación cuadra si
 * el monto es k veces la suma de sus cuotas mensuales, con k en pasos de
 * media cuota (0.5, 1, 1.5 ... 12). Cada hermano de esa combinación recibe
 * k x su cuota. Ejemplos reales:
 *  - Yomar Matos pagó RD$4,100 y RD$4,500 en dos facturas a su cédula: con
 *    hijas de cuota 4,100 y 4,500, cada monto solo cuadra con una de ellas.
 *  - E310000000060: RD$4,500 = media cuota de dos hermanos de Secundaria.
 * Si ninguna combinación cuadra, o cuadran dos (ej. RD$4,500 con dos
 * hermanos de 4,500: ¿uno entero o medio cada uno?), devuelve null y el
 * cobro va a la bandeja -- nunca se reparte a ojo.
 */
export function splitByTuition(
  amount: number,
  studentIds: string[],
  monthly: Record<string, number | null | undefined>
): { studentId: string; amount: number }[] | null {
  if (studentIds.length < 1 || studentIds.length > 6 || !(amount > 0)) return null
  const cuotas = studentIds.map((id) => Number(monthly[id]))
  if (cuotas.some((c) => !Number.isFinite(c) || c <= 0)) return null

  const soluciones: { studentId: string; amount: number }[][] = []
  for (let mask = 1; mask < 1 << studentIds.length; mask++) {
    const idx = studentIds.map((_, i) => i).filter((i) => mask & (1 << i))
    const suma = idx.reduce((acc, i) => acc + cuotas[i], 0)
    for (let k = 0.5; k <= 12; k += 0.5) {
      if (Math.abs(k * suma - amount) < 0.01) {
        soluciones.push(idx.map((i) => ({ studentId: studentIds[i], amount: Math.round(k * cuotas[i] * 100) / 100 })))
        break
      }
    }
  }
  return soluciones.length === 1 ? soluciones[0] : null
}

export function matchInvoice(
  invoice: AlegraInvoice,
  students: StudentRow[],
  guardians: GuardianRow[]
): MatchResult {
  const note = invoice.note
  const byId = new Map(students.map((s) => [s.id, s]))
  const asCand = (s: StudentRow, via: Candidate['via']): Candidate =>
    ({ studentId: s.id, name: `${s.first_name} ${s.last_name}`.trim(), gradeLevel: s.grade_level, via })

  // ── 0. Matrículas escritas en la nota: la instrucción más explícita ───
  // Convención de caja (2026-11-14): si el e-CF va a nombre del padre, se
  // escribe la matrícula de cada hijo en la nota. Solo manda si TODAS las
  // matrículas de la nota existen; si falta alguna, sigue el flujo normal.
  const codigos = matriculasEnNota(note)
  if (codigos.length > 0) {
    const porCodigo = codigos.map((c) => students.filter((s) => (s.student_code ?? '').trim().toLowerCase() === c))
    if (porCodigo.every((l) => l.length === 1)) {
      const nombrados = porCodigo.map((l) => l[0])
      const idType = (invoice.clientIdentificationType ?? '').toUpperCase()
      const idCode = (invoice.clientIdentification ?? '').trim().toLowerCase()
      const contacto = idType === 'IE' ? students.find((s) => (s.student_code ?? '').trim().toLowerCase() === idCode) : undefined
      if (contacto && !nombrados.some((s) => s.id === contacto.id)) {
        // El contacto de la factura es un estudiante y la nota habla de otro: a revisión.
        return { candidates: [asCand(contacto, 'matricula'), ...nombrados.map((s) => asCand(s, 'matricula_nota'))], auto: null, reason: 'nota_distinta' }
      }
      if (nombrados.length === 1) {
        const c = asCand(nombrados[0], 'matricula_nota')
        return { candidates: [c], auto: c, reason: null }
      }
      return { candidates: nombrados.map((s) => asCand(s, 'matricula_nota')), auto: null, reason: 'conjunto', splitIds: nombrados.map((s) => s.id) }
    }
  }

  const base = matchInvoiceByIdentity(invoice, students, guardians)

  const marcar = (cands: Candidate[]): Candidate[] =>
    cands
      .map((c) => {
        const s = byId.get(c.studentId)
        return s && studentNamedInNote(note, s) ? { ...c, namedInNote: true } : c
      })
      // El que la nota nombra va primero: es la sugerencia natural.
      .sort((a, b) => Number(!!b.namedInNote) - Number(!!a.namedInNote))

  // ── Comprobante conjunto (cédula del tutor, varios hijos) ─────────────
  // Si la nota nombra a algunos hijos, solo ellos; si nombra a uno, es suyo.
  // Si no nombra a nadie, se intenta repartir entre todos (solo si cuadra).
  if (base.reason === 'conjunto') {
    const hermanos = base.candidates.map((c) => byId.get(c.studentId)).filter((s): s is StudentRow => !!s)
    const nombrados = studentsNamedInNote(note, hermanos)
    if (nombrados.length === 1) {
      const c = asCand(nombrados[0], 'cedula_tutor')
      return { candidates: marcar(base.candidates), auto: { ...c, namedInNote: true }, reason: null }
    }
    const grupo = nombrados.length >= 2 ? nombrados : hermanos
    return { candidates: marcar(base.candidates), auto: null, reason: 'conjunto', splitIds: grupo.map((s) => s.id) }
  }

  if (!base.auto) {
    // Comprobante a nombre de una empresa (RNC), de un tutor cuya cédula no
    // está registrada, o con un nombre que no calza: si la nota nombra a UN
    // solo estudiante inscrito (nombre + apellido), el pago es suyo. Caso
    // real 2026-11-05: "Aparta Hotel Carmen", nota "a Liam Mercedes Martinez".
    // Si el contacto es OTRO estudiante con su matrícula, no se toca (eso
    // ya vino por la rama de matrícula y no llega aquí).
    const nombrados = studentsNamedInNote(note, students)
    if (nombrados.length === 1) {
      const c = { ...asCand(nombrados[0], 'nota'), namedInNote: true }
      const resto = base.candidates.filter((x) => x.studentId !== c.studentId)
      return { candidates: [c, ...marcar(resto)], auto: c, reason: null }
    }
    return { ...base, candidates: marcar(base.candidates) }
  }

  // ── La nota de Alegra contradice el emparejamiento automático ─────────
  // Caso real (2026-10-07, familia Felipe Frias): e-CF a nombre de la madre,
  // nota "para Analia Victoria Felipe Frias", pero Analia aún no estaba dada
  // de alta y Oliver era el único inscrito de esa familia. La regla 3 lo vio
  // "inequívoco" y le cargó a Oliver el pago de su hermana. Si la nota dice
  // otro nombre, eso no es inequívoco: va a la bandeja.
  const elegido = byId.get(base.auto.studentId)
  if (elegido && noteContradicts(note, elegido, base.auto.via, students, invoice.clientName)) {
    const otros = students
      .filter((s) => s.id !== elegido.id && studentNamedInNote(note, s) && noteMentionsSurname(note, s))
      .map((s): Candidate => ({ studentId: s.id, name: `${s.first_name} ${s.last_name}`.trim(), gradeLevel: s.grade_level, via: 'nota' }))
    // Si el comprobante va a nombre del TUTOR (cédula) y la nota nombra a
    // un único estudiante inscrito, con nombre y apellido, el pago es suyo:
    // quien factura dijo para quién era. (Caso Felipe Frias, una vez que
    // Analia ya está dada de alta.) Si vino por matrícula o nombre del
    // propio estudiante, el contacto contradice la nota: a revisión.
    const mejor = studentsNamedInNote(note, students.filter((s) => s.id !== elegido.id))
    if (base.auto.via === 'cedula_tutor' && mejor.length === 1) {
      const c = { ...asCand(mejor[0], 'nota'), namedInNote: true }
      return { candidates: marcar([...base.candidates, c]), auto: c, reason: null }
    }
    return { candidates: marcar([...base.candidates, ...otros]), auto: null, reason: 'nota_distinta' }
  }

  const auto = marcar([base.auto])[0]
  return { candidates: marcar(base.candidates), auto, reason: null }
}

/** Palabras con contenido (3+ letras) de un texto, normalizadas. */
function palabras(value: string | null | undefined): string[] {
  return normalizeName(value).split(' ').filter((w) => w.length > 2)
}

/**
 * Igual que `palabraSeParece` pero sin tolerancia en palabras cortas: en una
 * nota libre, "ana" no puede emparejar con "una".
 */
function mismaPalabraEnNota(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.min(a.length, b.length) < 5) return false
  return palabraSeParece(a, b)
}

/** ¿La nota nombra a este estudiante? (por su primer nombre) */
export function studentNamedInNote(note: string | null | undefined, s: StudentRow): boolean {
  const nota = palabras(note)
  const primerNombre = palabras(s.first_name)[0]
  if (!primerNombre || nota.length === 0) return false
  return nota.some((w) => mismaPalabraEnNota(w, primerNombre))
}

/**
 * ¿A qué estudiante(s) nombra la nota? Devuelve los que mejor coinciden.
 *
 * Elegible: la nota trae su primer nombre Y al menos un apellido. Entre los
 * elegibles gana quien tenga MÁS palabras de su nombre en la nota. Esto
 * resuelve hermanos con el mismo primer nombre -- caso real 2026-11-04,
 * "de Luis David Jimenez Santana" vs su hermano Luis Manuel -- y tolera
 * una letra por palabra ("Yosmalilyn" en Alegra = "Yosmailyn" aquí). Si
 * empatan varios, devuelve todos y quien llame decide (nunca adivina).
 */
export function studentsNamedInNote(note: string | null | undefined, students: StudentRow[]): StudentRow[] {
  const nota = palabras(note)
  if (nota.length === 0) return []
  const tiene = (w: string) => nota.some((n) => mismaPalabraEnNota(n, w))
  const puntuados = students
    .map((s) => {
      const nombres = palabras(s.first_name)
      const apellidos = palabras(s.last_name)
      if (!nombres[0] || !tiene(nombres[0])) return null
      if (!apellidos.some((a) => tiene(a))) return null
      const score = [...nombres, ...apellidos].filter((w) => tiene(w)).length
      return { s, score }
    })
    .filter((x): x is { s: StudentRow; score: number } => !!x)
  if (puntuados.length === 0) return []
  const max = Math.max(...puntuados.map((x) => x.score))
  return puntuados.filter((x) => x.score === max).map((x) => x.s)
}

/** ¿La nota menciona algún apellido de este estudiante (= habla de su familia)? */
function noteMentionsSurname(note: string | null | undefined, s: StudentRow): boolean {
  const nota = palabras(note)
  const apellidos = palabras(s.last_name).filter((w) => w.length >= 4)
  return apellidos.some((a) => nota.some((w) => mismaPalabraEnNota(w, a)))
}

/**
 * La nota habla de OTRA persona, no del estudiante elegido:
 *  - nombra a otro estudiante inscrito (nombre + apellido), sin nombrar al
 *    elegido; o
 *  - (solo si se emparejó por la cédula del tutor) menciona el apellido de
 *    la familia pero no el nombre del elegido -- es un hermano que todavía
 *    no está dado de alta, exactamente el caso Felipe Frias. Antes se
 *    quitan de la nota las palabras del nombre del tutor (el cliente de
 *    Alegra): "e-CF a nombre del tutor Carlos Reyes" habla del tutor, no de
 *    otro hijo.
 * Una nota vacía o sin nombres ("Pago de octubre") no contradice nada.
 */
function noteContradicts(
  note: string | null | undefined,
  elegido: StudentRow,
  via: Candidate['via'],
  students: StudentRow[],
  clientName: string | null | undefined
): boolean {
  if (palabras(note).length === 0) return false
  if (studentNamedInNote(note, elegido)) return false
  const nombraAOtro = students.some(
    (s) => s.id !== elegido.id && studentNamedInNote(note, s) && noteMentionsSurname(note, s)
  )
  if (nombraAOtro) return true
  if (via !== 'cedula_tutor') return false
  const delTutor = new Set(palabras(clientName))
  const notaSinTutor = palabras(note).filter((w) => !delTutor.has(w)).join(' ')
  return noteMentionsSurname(notaSinTutor, elegido)
}

function matchInvoiceByIdentity(
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
