#!/usr/bin/env node --experimental-strip-types
/**
 * Prueba del núcleo de emparejamiento de la conciliación con Alegra.
 *
 *   node --experimental-strip-types scripts/test-alegra-matching.mjs
 *
 * No toca ninguna base ni ninguna API: `alegraMatching.ts` es puro a
 * propósito. Los casos NO son inventados -- son los que de verdad
 * rompieron (o casi rompen) la conciliación hecha a mano el 2026-09-09:
 * nombres con espacio al final, doble espacio, mayúsculas, ñ, guiones, y
 * los cuatro descuadres de una letra entre Alegra y la plataforma.
 *
 * Si alguien toca las reglas de emparejamiento, esto es lo que dice si se
 * rompió algo -- `tsc`/`lint`/`build` no se enteran de un cambio de
 * criterio.
 */
import { normalizeName, mensualidadAmount, matchInvoice } from '../web/src/lib/accounting/alegraMatching.ts'

const S = (id, first, last, code, family, grade) =>
  ({ id, first_name: first, last_name: last, student_code: code, family_id: family, grade_level: grade })

// Escritos como están en la PLATAFORMA (Alegra los escribe distinto abajo).
const alumnos = [
  S('s1', 'Heather Liz', 'Rondon Castillo', null, 'f1', '3ro. Primaria'),
  S('s2', 'Dhanel Elian', 'Leonardo Mercedes', null, 'f2', '1ro. Primaria'),
  S('s3', 'Teylor Adrian', 'Diaz Mota', null, 'f3', '2do. Primaria'),
  S('s4', 'Onaimi Nayeli', 'Nuñez Rivera', null, 'f4', '1ro. Secundaria'),
  S('s5', 'Osvaldo Andres', 'Nuñez Rivera', null, 'f4', '4to. Secundaria'),
  S('s6', 'Karolyn', 'Matos Montero', null, 'f5', '5to. Primaria'),
  S('s7', 'Yariel Emilio', 'Gil Solis', '24-0039', 'f6', '1ro. Primaria'),
  S('s8', 'Sarha', 'Olivares Perez', null, 'f7', '4to. Primaria'),
  S('s9', 'Jean', 'Saint-Hilaire', null, 'f8', '2do. Secundaria'),
]

const tutores = [
  { family_id: 'f4', first_name: 'Osvaldo', last_name: 'Nuñez Castro', national_id: '02300785520' },
  { family_id: 'f5', first_name: 'Yomar', last_name: 'Matos', national_id: '023-0157420-4' },
]

const inv = (o) => ({
  id: o.id ?? '1', date: '2026-09-05', status: 'closed',
  fullNumber: o.n ?? 'E320000000001',
  clientName: o.name ?? null,
  clientIdentification: o.ident ?? null,
  clientIdentificationType: o.type ?? null,
  total: 0, balance: 0, paymentMethod: 'cash', note: null,
  items: o.items ?? [{ name: 'Mensualidad', total: 2050 }],
})

let fallos = 0
const check = (etiqueta, real, esperado) => {
  const ok = real === esperado
  if (!ok) fallos++
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${etiqueta} -> ${real}${ok ? '' : `  (esperado: ${esperado})`}`)
}
const auto = (i) => {
  const r = matchInvoice(i, alumnos, tutores)
  return r.auto ? r.auto.studentId : `revision:${r.reason}`
}
const sugiere = (i) => matchInvoice(i, alumnos, tutores).candidates.map((c) => c.studentId).sort().join(',')

console.log('== Normalización de nombres (casos reales de Alegra) ==')
check('espacio al final', normalizeName('Teylor Andrian Diaz Mota '), 'teylor andrian diaz mota')
check('doble espacio', normalizeName('Dhanel Elian  Leonardo Mercedes'), 'dhanel elian leonardo mercedes')
check('todo en mayúsculas', normalizeName('HEATHER LIZ RONDON CASTILLO'), 'heather liz rondon castillo')
check('ñ y tildes', normalizeName('Onaimi Nayeli Núñez Rivera'), 'onaimi nayeli nunez rivera')
check('guion en el apellido', normalizeName('Jean Saint-Hilaire'), 'jean saint hilaire')

console.log('\n== Monto: solo lo que es cuota baja la deuda de mensualidad ==')
check('mensualidad + recargo por mora', mensualidadAmount(inv({ items: [{ name: 'Mensualidad', total: 2050 }, { name: 'Recargo por Mora', total: 102.5 }] })), 2050)
check('solo libros no es cuota', mensualidadAmount(inv({ items: [{ name: 'Libros', total: 2235 }] })), 0)
check('abono sí es cuota', mensualidadAmount(inv({ items: [{ name: 'Abono', total: 1950 }] })), 1950)
check('uniformes quedan fuera', mensualidadAmount(inv({ items: [{ name: 'Uniformes', total: 1500 }, { name: 'Mensualidad', total: 4100 }] })), 4100)

console.log('\n== Se carga solo (emparejamiento inequívoco) ==')
check('matrícula IE exacta', auto(inv({ ident: '24-0039', type: 'IE', name: 'Yariel Emilio Gil Solis' })), 's7')
check('nombre en mayúsculas', auto(inv({ name: 'HEATHER LIZ RONDON CASTILLO' })), 's1')
check('nombre con doble espacio', auto(inv({ name: 'Dhanel Elian  Leonardo Mercedes' })), 's2')
check('apellido con guion', auto(inv({ name: 'Jean Saint-Hilaire' })), 's9')
check('cédula del tutor con un solo hijo', auto(inv({ ident: '023-0157420-4', type: 'CED', name: 'Yomar Matos' })), 's6')
check('matrícula que no está cargada: cae a nombre', auto(inv({ ident: '99-9999', type: 'IE', name: 'Heather Liz Rondon Castillo' })), 's1')

console.log('\n== NO se carga solo: va a la bandeja de revisión ==')
check('e-CF conjunto de dos hermanos', auto(inv({ ident: '02300785520', type: 'CED', name: 'Osvaldo Nuñez Castro' })), 'revision:conjunto')
check('Andrian vs Adrian', auto(inv({ name: 'Teylor Andrian Diaz Mota ' })), 'revision:aproximado')
check('Sara Olivarez vs Sarha Olivares', auto(inv({ name: 'Sara Olivarez Perez' })), 'revision:aproximado')
check('estudiante que no existe en la plataforma', auto(inv({ name: 'Victor Emmanuel Sanchez Pilier', ident: '16-0059', type: 'IE' })), 'revision:sin_emparejar')

console.log('\n== La bandeja recibe candidatos útiles, no una hoja en blanco ==')
check('los dos hermanos del e-CF conjunto', sugiere(inv({ ident: '02300785520', type: 'CED', name: 'Osvaldo Nuñez Castro' })), 's4,s5')
check('Andrian sugiere a Adrian', sugiere(inv({ name: 'Teylor Andrian Diaz Mota ' })), 's3')
check('Sara Olivarez sugiere a Sarha Olivares', sugiere(inv({ name: 'Sara Olivarez Perez' })), 's8')

console.log(fallos === 0 ? '\nTodas las comprobaciones OK' : `\n${fallos} comprobaciones FALLARON`)
process.exit(fallos === 0 ? 0 : 1)
