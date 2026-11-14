#!/usr/bin/env -S npx tsx
/**
 * Prueba del vínculo de matrículas de Alegra (alegraStudentCodes.ts).
 *   npx --prefix web tsx scripts/test-alegra-student-codes.mjs
 * Puro: no toca base ni API. Nombres de Alegra tal como vienen (espacio final,
 * mayúsculas) y los descuadres reales de una letra; la plataforma manda.
 */
import { planStudentCodeLinks } from '../web/src/lib/accounting/alegraStudentCodes.ts'

let ok = 0, fail = 0
const check = (label, cond) => { if (cond) { ok++; console.log('OK  ', label) } else { fail++; console.log('FALLA', label) } }
const S = (id, first, last, code = null) => ({ id, first_name: first, last_name: last, student_code: code })

const students = [
  S('s1', 'Aleybi Siloe', 'Guaba De Los Santos'),     // Alegra con espacio final
  S('s2', 'Teylor Adrian', 'Diaz Mota'),              // Alegra: "Andrian"
  S('s3', 'Sarha Abigail', 'Calis Gonzalez'),         // Alegra: "Sara"
  S('s4', 'Camille', 'Saint Hilaire Morales'),        // Alegra: "Morale"
  S('s5', 'Abdier Jesus', 'Fernandez Peña'),          // Alegra sin 2do apellido
  S('s6', 'Victor Enmanuel', 'Sanchez Pilier', '16-0059'), // ya vinculado
  S('s7', 'Maria', 'Perez Lopez'),                    // homónimos parciales
  S('s8', 'Maria Elena', 'Perez Lopez'),
  S('s9', 'Blayder Emmanuel', 'Solis Castillo'),
]
const contacts = [
  { name: 'Aleybi Siloe Guaba De Los Santos ', code: '26-0004' },
  { name: 'Teylor Andrian Diaz Mota ', code: '24-0100' },
  { name: 'Sara Abigail Calis Gonzalez', code: '24-0101' },
  { name: 'Camille Saint Hilaire Morale', code: '24-0102' },
  { name: 'Abdier Jesus Fernandez', code: '25-0025' },
  { name: 'Victor Emmanuel Sanchez Pilier', code: '16-0059' }, // ya usada
  { name: 'Maria Perez', code: '24-0200' },                     // ambiguo
  { name: 'Ana Maria Frias Peguero', code: '02301608713' },     // no es matrícula
  { name: 'Persona De Otro Colegio', code: '24-0999' },
  { name: 'Blayder Emmanuel Solis Castillo', code: '24-0041' },
  { name: 'Blayder E Solis Castillo', code: '24-0041' },        // matrícula duplicada en Alegra
]

const plan = planStudentCodeLinks(contacts, students)
const linkOf = (id) => plan.links.find((l) => l.studentId === id)

check('exacto con espacio final', linkOf('s1')?.code === '26-0004' && linkOf('s1')?.level === 'exacto')
check('Andrian→Adrian se vincula (manda la plataforma)', linkOf('s2')?.code === '24-0100')
check('Sara→Sarha se vincula', linkOf('s3')?.code === '24-0101')
check('Morale→Morales se vincula', linkOf('s4')?.code === '24-0102')
check('falta 2do apellido en Alegra se vincula', linkOf('s5')?.code === '25-0025')
check('no toca al que ya tiene matrícula', !linkOf('s6'))
check('matrícula ya usada no se reasigna', !plan.links.some((l) => l.code === '16-0059'))
check('ambiguo (dos Maria Perez Lopez) NO se vincula solo', !linkOf('s7') && !linkOf('s8'))
check('ambiguo queda como sugerencia', plan.suggestions.some((s) => s.code === '24-0200' && s.candidates.length === 2))
check('cédula no se trata como matrícula', !plan.links.some((l) => l.code === '02301608713'))
check('matrícula repetida en Alegra no se vincula', !linkOf('s9'))
check('contacto sin parecido cuenta como sin estudiante', plan.unmatched >= 1)
check('ya vinculados contados', plan.alreadyLinked === 1)

// Dos contactos distintos apuntando al mismo estudiante → ninguno solo
const p2 = planStudentCodeLinks(
  [{ name: 'Teylor Adrian Diaz Mota', code: '24-0300' }, { name: 'Teylor Andrian Diaz Mota', code: '24-0301' }],
  [S('t1', 'Teylor Adrian', 'Diaz Mota')]
)
check('dos matrículas para el mismo estudiante → a confirmar', p2.links.length === 0 && p2.suggestions.length === 2)

// Nombre de pila distinto no se vincula solo
const p3 = planStudentCodeLinks([{ name: 'Bladimir Emmanuel Solis Sosa', code: '24-0041' }], [S('u1', 'Blayder Emmanuel', 'Solis Castillo')])
check('nombre de pila distinto nunca se vincula solo', p3.links.length === 0)

console.log(`\n${ok} OK, ${fail} fallas`)
process.exit(fail ? 1 : 0)
