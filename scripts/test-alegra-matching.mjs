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
import { normalizeName, mensualidadAmount, matchInvoice, splitByTuition, matriculasEnNota } from '../web/src/lib/accounting/alegraMatching.ts'

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

// ── Caso real 2026-10-07: familia Felipe Frias ───────────────────────────
// e-CF E310000000099 a nombre de la madre (cédula), nota "para Analia...".
// Ese día Analia no estaba dada de alta: Oliver era el único inscrito, y el
// motor le cargó a Oliver el pago de su hermana.
console.log('\n== La nota de Alegra contradice el emparejamiento (caso Felipe Frias) ==')
const oliver = S('ff1', 'Oliver de Jesus', 'Felipe Frias', null, 'ff', 'Kinder')
const analia = S('ff2', 'Analia Victoria ', 'Felipe Frias ', null, 'ff', 'Parvulo')
const tutoraFF = [{ family_id: 'ff', first_name: 'Ana Maria', last_name: 'Frias Peguero', national_id: '023-0160871-3' }]
const ff = (note, lista) => matchInvoice(
  { ...inv({ ident: '02301608713', type: 'CED', name: 'Ana Maria Frias Peguero ', items: [{ name: 'Mensualidad', total: 5250 }] }), note },
  [...alumnos, ...lista], [...tutores, ...tutoraFF]
)
const ffAuto = (note, lista) => { const r = ff(note, lista); return r.auto ? r.auto.studentId : `revision:${r.reason}` }

check('solo Oliver inscrito, nota nombra a Analia -> bandeja',
  ffAuto('Medio mes de ago, mora y mes de sep, para Analia Victoria Felipe Frias', [oliver]), 'revision:nota_distinta')
check('solo Oliver inscrito, nota nombra a Oliver -> se carga',
  ffAuto('Pago mes de octubre, de Oliver de jesùs Felipe Frias.', [oliver]), 'ff1')
check('solo Oliver inscrito, nota sin nombres -> se carga', ffAuto('Pago de octubre', [oliver]), 'ff1')
check('solo Oliver inscrito, sin nota -> se carga', ffAuto(null, [oliver]), 'ff1')
// Desde 2026-11-14: si la nota nombra a UNO de los hermanos, el pago es suyo.
check('los dos inscritos, la nota nombra a Analia -> se le carga a Analia',
  ffAuto('Pago de Octubre, de Analia Victoria Felipe Frias.', [oliver, analia]), 'ff2')
check('conjunto: el nombrado en la nota va primero y marcado',
  (() => { const c = ff('Pago de Octubre, de Analia Victoria Felipe Frias.', [oliver, analia]).candidates; return `${c[0].studentId}:${!!c[0].namedInNote}:${!!c[1].namedInNote}` })(),
  'ff2:true:false')
check('nombre exacto, pero la nota nombra a otro estudiante inscrito -> bandeja',
  auto({ ...inv({ name: 'HEATHER LIZ RONDON CASTILLO' }), note: 'Mensualidad de Karolyn Matos' }), 'revision:nota_distinta')
check('nombre exacto con nota que solo trae el mes -> se carga',
  auto({ ...inv({ name: 'HEATHER LIZ RONDON CASTILLO' }), note: 'media cuota agosto' }), 's1')
check('"Ana" en la nota no confunde con "una"',
  ffAuto('Pago de una cuota, Oliver Felipe', [oliver, S('ff3', 'Ana', 'Felipe Frias', null, 'zz', 'Kinder')]), 'ff1')
check('nota que nombra al tutor (no a otro hijo) -> se carga',
  auto({ ...inv({ ident: '023-0157420-4', type: 'CED', name: 'Yomar Matos' }), note: 'media cuota agosto (e-CF a nombre del tutor Yomar Matos)' }), 's6')

console.log('\n== Automatización de la bandeja (2026-11-14) ==')
// Hermanos con matrícula, para la convención "matrícula en la nota".
const conCodigo = [
  S('m1', 'Onaimi Nayeli', 'Nuñez Rivera', '24-0050', 'f4', '1ro. Secundaria'),
  S('m2', 'Osvaldo Andres', 'Nuñez Rivera', '24-0051', 'f4', '4to. Secundaria'),
  S('m3', 'Otro', 'Estudiante Aparte', '24-0099', 'f9', '2do. Primaria'),
]
const mm = (o) => matchInvoice({ ...inv(o), note: o.note ?? null }, conCodigo, tutores)
const mmAuto = (o) => { const r = mm(o); return r.auto ? r.auto.studentId : `revision:${r.reason}` }

check('lee las matrículas de la nota', matriculasEnNota('Mes de sep 24-0050 y 24-0051.').join(','), '24-0050,24-0051')
check('una matrícula en la nota (e-CF del tutor) -> se carga a ese hijo',
  mmAuto({ ident: '02300785520', type: 'CED', name: 'Osvaldo Nuñez Castro', note: 'Septiembre 24-0051' }), 'm2')
check('dos matrículas en la nota -> conjunto con esos dos para repartir',
  (mm({ ident: '02300785520', type: 'CED', name: 'Osvaldo Nuñez Castro', note: 'Sep 24-0050, 24-0051' }).splitIds ?? []).sort().join(','), 'm1,m2')
check('matrícula en la nota que no existe -> sigue el flujo normal (conjunto por cédula)',
  mmAuto({ ident: '02300785520', type: 'CED', name: 'Osvaldo Nuñez Castro', note: 'Sep 24-7777' }), 'revision:conjunto')
check('contacto es un estudiante y la nota trae la matrícula de OTRO -> bandeja',
  mmAuto({ ident: '24-0099', type: 'IE', name: 'Otro Estudiante Aparte', note: 'pago de 24-0050' }), 'revision:nota_distinta')
check('contacto estudiante con su propia matrícula en la nota -> se carga',
  mmAuto({ ident: '24-0050', type: 'IE', name: 'Onaimi Nayeli Nuñez Rivera', note: 'sep 24-0050' }), 'm1')
check('conjunto sin nombres en la nota -> se propone repartir entre todos los hermanos',
  (matchInvoice(inv({ ident: '02300785520', type: 'CED', name: 'Osvaldo Nuñez Castro' }), alumnos, tutores).splitIds ?? []).sort().join(','), 's4,s5')

// Reparto: el caso real E310000000060 (RD$4,500 = media cuota de dos de Secundaria)
const rep = (monto, cuotas) => { const r = splitByTuition(monto, Object.keys(cuotas), cuotas); return r ? r.map((p) => `${p.studentId}:${p.amount}`).join(',') : 'no-cuadra' }
// RD$4,500 con dos hermanos de 4,500: ¿una cuota entera de uno, o media de cada uno? No se adivina.
check('E310000000060 sin nota: RD$4,500 con dos de Secundaria es ambiguo', rep(4500, { a: 4500, b: 4500 }), 'no-cuadra')
check('RD$9,000 con Primaria+Secundaria: única forma = 2 meses del de Secundaria', rep(9000, { a: 4100, b: 4500 }), 'b:9000')
check('cuotas distintas (Primaria + Secundaria), 1 mes completo', rep(8600, { a: 4100, b: 4500 }), 'a:4100,b:4500')
check('con descuento por hermanos (3ro al 10%), 1 mes', rep(12790, { a: 4500, b: 4100, c: 4190 }), 'a:4500,b:4100,c:4190')
check('monto que no cuadra -> no se reparte (bandeja)', rep(5000, { a: 4500, b: 4500 }), 'no-cuadra')
// Caso real 2026-11-02: Yomar Matos pagó dos facturas a su cédula, una por hija.
check('Yomar RD$4,100 -> solo cuadra con la hija de Primaria', rep(4100, { karolyn: 4100, yosmailyn: 4500 }), 'karolyn:4100')
check('Yomar RD$4,500 -> solo cuadra con la hija de Secundaria', rep(4500, { karolyn: 4100, yosmailyn: 4500 }), 'yosmailyn:4500')
check('dos hermanos de igual cuota y monto de una cuota -> ambiguo (bandeja)', rep(4500, { a: 4500, b: 4500 }) === 'a:2250,b:2250' ? 'ambiguo-no-detectado' : rep(4500, { a: 4500, b: 4500 }), 'no-cuadra')
check('un hermano sin cuota configurada -> no se reparte', rep(4500, { a: 4500, b: null }), 'no-cuadra')
check('dos meses completos', rep(17200, { a: 4100, b: 4500 }), 'a:8200,b:9000')

console.log('\n== Casos reales de noviembre 2026: la nota dice para quién es ==')
const nov = [
  S('n1', 'Luis David', 'Jimenez Santana', null, 'fj', '2do. Primaria'),
  S('n2', 'Luis Manuel', 'Jimenez Santana', null, 'fj', '4to. Primaria'),
  S('n3', 'Edian', 'Mercedes Martinez', null, 'fm', '3ro. Primaria'),
  S('n4', 'Liam', 'Mercedes Martinez', null, 'fm', '1ro. Secundaria'),
  S('n5', 'Yosmailyn', 'Matos Montero', null, 'fy', '6to. Primaria'),
  S('n6', 'Karolyn', 'Matos Montero', null, 'fy', '2do. Secundaria'),
]
const tutNov = [
  { family_id: 'fj', first_name: 'Ivelisse', last_name: 'Santana', national_id: '02301098964' },
  { family_id: 'fy', first_name: 'Yomar', last_name: 'Matos', national_id: '02301574204' },
]
const nv = (o) => { const r = matchInvoice({ ...inv(o), note: o.note }, nov, tutNov); return r.auto ? r.auto.studentId : `revision:${r.reason}` }
check('hermanos "Luis David" y "Luis Manuel": la nota elige bien (E310000000134)',
  nv({ ident: '02301098964', type: 'CED', name: 'Ivelisse Santana', note: 'Pago mensualidad de octubre, de Luis David Jimenez Santana.' }), 'n1')
check('...y el otro Luis (E310000000135)',
  nv({ ident: '02301098964', type: 'CED', name: 'Ivelisse Santana', note: 'Pago mensualidad de Octubre, de Luis Manuel Jimenez Santana.' }), 'n2')
check('empresa (RNC) que paga por un estudiante nombrado en la nota (E310000000142)',
  nv({ ident: '132099494', type: 'RNC', name: 'Aparta Hotel Carmen', note: 'pago mes de octubre, a Liam Mercedes Martinez.' }), 'n4')
check('nombre con una letra distinta en la nota ("Yosmalilyn") (E310000000130)',
  nv({ ident: '02301574204', type: 'CED', name: 'Yomar Matos', note: 'pago mes de octubre, de Yosmalilyn Matos Montero.' }), 'n5')
check('empresa sin nombres en la nota -> bandeja (E310000000132)',
  nv({ ident: '133613001', type: 'RNC', name: 'EVENTOS Y DECORACIONES S & V 2405 SRL', note: 'Mes de octubre' }), 'revision:sin_emparejar')
check('cédula no registrada + nota con nombre y un solo apellido',
  nv({ ident: '02300000000', type: 'CED', name: 'Una Abuela', note: 'pago de Edian Mercedes' }), 'n3')
check('nota con solo el primer nombre compartido ("Luis") -> no adivina',
  nv({ ident: '133613001', type: 'RNC', name: 'Empresa X', note: 'pago de Luis Jimenez' }), 'revision:sin_emparejar')

console.log(fallos === 0 ? '\nTodas las comprobaciones OK' : `\n${fallos} comprobaciones FALLARON`)
process.exit(fallos === 0 ? 0 : 1)
