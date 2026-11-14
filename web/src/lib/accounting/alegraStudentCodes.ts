import { normalizeName, palabraSeParece } from './alegraMatching'

/**
 * Vincula cada estudiante de la plataforma con su matrícula de Alegra
 * (`students.student_code`), para que la conciliación empareje por
 * matrícula y deje de depender de cómo se escribió el nombre.
 *
 * REGLA DEL COLEGIO (2026-11-14): ante una discrepancia, MANDA el nombre de
 * la plataforma. Por eso aquí nunca se toca un nombre: solo se guarda la
 * matrícula de Alegra en la ficha del estudiante. Las actas de nacimiento
 * ya dieron la razón a la plataforma 4 de 4 veces (ver AGENTS.md).
 *
 * Puro a propósito (sin Supabase ni Next.js): se prueba en
 * `scripts/test-alegra-student-codes.mjs`.
 *
 * Niveles:
 *  - `exacto`: mismo nombre normalizado (sin tildes, mayúsculas ni espacios
 *    de más). Se vincula solo.
 *  - `parecido`: el nombre de Alegra está contenido en el de la plataforma,
 *    tolerando una letra por palabra (Sara/Sarha, Morale/Morales) y la
 *    falta de un apellido, con el PRIMER nombre coincidiendo y al menos 3
 *    palabras. Se vincula solo SOLO si es el único candidato en los dos
 *    sentidos (ese contacto solo apunta a ese estudiante y ese estudiante
 *    solo recibe ese contacto).
 *  - `sugerido`: cualquier otro parecido -- se muestra para confirmar a
 *    mano, nunca se vincula solo.
 */

export interface AlegraStudentContact {
  name: string
  /** Matrícula, ej. "24-0033" */
  code: string
}

export interface LinkableStudent {
  id: string
  first_name: string
  last_name: string
  student_code: string | null
}

export interface CodeLink {
  studentId: string
  studentName: string
  code: string
  alegraName: string
  level: 'exacto' | 'parecido'
}

export interface CodeSuggestion {
  code: string
  alegraName: string
  candidates: { studentId: string; studentName: string }[]
}

export interface LinkPlan {
  links: CodeLink[]
  suggestions: CodeSuggestion[]
  /** Contactos de Alegra sin ningún estudiante parecido (otros colegios, retirados, etc.) */
  unmatched: number
  /** Estudiantes que ya tenían matrícula: no se tocan. */
  alreadyLinked: number
}

const MATRICULA = /^\d{2}-\d{3,5}$/

export function isStudentCode(value: string | null | undefined): boolean {
  return MATRICULA.test((value ?? '').trim())
}

function words(value: string): string[] {
  return normalizeName(value).split(' ').filter(Boolean)
}

/** ¿El nombre de Alegra cabe en el de la plataforma? (tolerancia de una letra por palabra) */
function alegraFitsStudent(alegra: string[], student: string[]): boolean {
  if (alegra.length < 3 || student.length === 0) return false
  if (!palabraSeParece(alegra[0], student[0])) return false
  const usadas = new Set<number>()
  for (const w of alegra) {
    const idx = student.findIndex((p, i) => !usadas.has(i) && palabraSeParece(w, p))
    if (idx === -1) return false
    usadas.add(idx)
  }
  return true
}

/** Parecido débil, solo para sugerir: comparten el primer nombre y algún apellido. */
function loosely(alegra: string[], student: string[]): boolean {
  if (alegra.length < 2 || student.length < 2) return false
  if (!palabraSeParece(alegra[0], student[0])) return false
  const resto = student.slice(1)
  return alegra.slice(1).filter((w) => w.length > 2 && resto.some((p) => palabraSeParece(w, p))).length >= 1
}

export function planStudentCodeLinks(
  contacts: AlegraStudentContact[],
  students: LinkableStudent[]
): LinkPlan {
  const fullName = (s: LinkableStudent) => `${s.first_name} ${s.last_name}`.replace(/\s+/g, ' ').trim()

  // Matrículas ya usadas en la plataforma: nunca se repiten (índice único).
  const usedCodes = new Set(
    students.map((s) => (s.student_code ?? '').trim().toLowerCase()).filter(Boolean)
  )
  const pending = students.filter((s) => !(s.student_code ?? '').trim())
  const alreadyLinked = students.length - pending.length

  // Una matrícula repetida en Alegra (dos contactos) es ambigua: se ignora.
  const codeCount = new Map<string, number>()
  for (const c of contacts) {
    const k = c.code.trim().toLowerCase()
    codeCount.set(k, (codeCount.get(k) ?? 0) + 1)
  }
  const usable = contacts.filter((c) => {
    const k = c.code.trim().toLowerCase()
    return isStudentCode(c.code) && codeCount.get(k) === 1 && !usedCodes.has(k)
  })

  const pendingWords = pending.map((s) => ({ s, w: words(fullName(s)), n: normalizeName(fullName(s)) }))

  type Prop = { contact: AlegraStudentContact; studentId: string; level: 'exacto' | 'parecido' }
  const proposals: Prop[] = []
  const suggestions: CodeSuggestion[] = []
  let unmatched = 0

  for (const contact of usable) {
    const n = normalizeName(contact.name)
    const exact = pendingWords.filter((x) => x.n === n)
    if (exact.length === 1) { proposals.push({ contact, studentId: exact[0].s.id, level: 'exacto' }); continue }

    const aw = words(contact.name)
    const fits = exact.length > 1 ? exact : pendingWords.filter((x) => alegraFitsStudent(aw, x.w))
    if (fits.length === 1 && exact.length === 0) {
      proposals.push({ contact, studentId: fits[0].s.id, level: 'parecido' })
      continue
    }

    const loose = fits.length > 0 ? fits : pendingWords.filter((x) => loosely(aw, x.w))
    if (loose.length > 0) {
      suggestions.push({
        code: contact.code.trim(),
        alegraName: contact.name.trim(),
        candidates: loose.slice(0, 5).map((x) => ({ studentId: x.s.id, studentName: fullName(x.s) })),
      })
    } else {
      unmatched++
    }
  }

  // Unicidad en el otro sentido: si dos contactos apuntan al mismo
  // estudiante, ninguno se vincula solo -- pasan a sugerencia.
  const perStudent = new Map<string, Prop[]>()
  for (const p of proposals) perStudent.set(p.studentId, [...(perStudent.get(p.studentId) ?? []), p])

  const byId = new Map(pending.map((s) => [s.id, s]))
  const links: CodeLink[] = []
  for (const [studentId, props] of perStudent) {
    const s = byId.get(studentId)!
    if (props.length === 1) {
      const p = props[0]
      links.push({ studentId, studentName: fullName(s), code: p.contact.code.trim(), alegraName: p.contact.name.trim(), level: p.level })
    } else {
      for (const p of props) {
        suggestions.push({
          code: p.contact.code.trim(),
          alegraName: p.contact.name.trim(),
          candidates: [{ studentId, studentName: fullName(s) }],
        })
      }
    }
  }

  links.sort((a, b) => a.studentName.localeCompare(b.studentName))
  suggestions.sort((a, b) => a.alegraName.localeCompare(b.alegraName))
  return { links, suggestions, unmatched, alreadyLinked }
}
