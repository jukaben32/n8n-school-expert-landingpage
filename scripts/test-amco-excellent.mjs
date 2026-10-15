#!/usr/bin/env node --experimental-strip-types
/**
 * Prueba del correo de acceso a Excellent (Amco).
 *
 *   node --experimental-strip-types scripts/test-amco-excellent.mjs
 *
 * Puro: no toca base ni red. Comprueba que el texto que recibe cada familia
 * traga todo lo que pidió la Coordinación de Inglés y que el asistente de IA
 * recibe los mismos datos (enlace, tutorial, contraseña).
 */
import assert from 'node:assert/strict'
import {
  buildExcellentAccessEmail, EXCELLENT_FAQ_SECTION, EXCELLENT_URL, EXCELLENT_TUTORIAL_URL,
  EXCELLENT_PASSWORD, EXCELLENT_SCHOOL_SITE_URL,
} from '../web/src/lib/amco/excellentEmail.ts'

let passed = 0
const check = (name, fn) => { fn(); passed += 1; console.log(`  OK  ${name}`) }

const one = buildExcellentAccessEmail([{ fullName: 'Cielo Johandy De la Cruz Martinez', grade: '1ro. Secundaria', amcoEmail: 'cielod4@do.amcoedu.org' }])
const two = buildExcellentAccessEmail([
  { fullName: 'Karolyn Matos Montero', grade: '2do. Secundaria', amcoEmail: 'karolynm5@do.amcoedu.org' },
  { fullName: 'Yosmailyn Matos Montero', grade: '6to. Primaria', amcoEmail: 'yosmailynm5@do.amcoedu.org' },
])

check('un hijo: trae su correo de Amco, el enlace, el tutorial y la contraseña', () => {
  for (const t of ['cielod4@do.amcoedu.org', EXCELLENT_URL, EXCELLENT_TUTORIAL_URL, EXCELLENT_SCHOOL_SITE_URL, `Contraseña: ${EXCELLENT_PASSWORD} (del 1 al 8)`, '2026-2027']) {
    assert.ok(one.body.includes(t), t)
  }
})
check('conserva las frases del comunicado original de la Coordinación', () => {
  for (const t of ['Reciban un cordial saludo.', 'Excellent, donde nuestros estudiantes realizarán sus exámenes de inglés', 'descargar la aplicación en un teléfono o tableta compatible',
    'Favor esperar nuestra autorización antes de iniciarlos.', 'Agradecemos su colaboración y apoyo.', 'Coordinación del Área de Inglés', 'Centro Gran Manantial de Sabiduría (CEGMAS)']) {
    assert.ok(one.body.includes(t), t)
  }
})
check('pide el apoyo de los padres en casa', () => assert.match(one.body, /apoyo que necesit/))
check('dos hijos: lista a los dos y habla en plural', () => {
  assert.ok(two.body.includes('karolynm5@do.amcoedu.org') && two.body.includes('yosmailynm5@do.amcoedu.org'))
  assert.match(two.body, /Correos de Amco de sus hijos/)
  assert.ok(!one.body.includes('Correos de Amco de sus hijos'))
})
check('el correo de una familia nunca contiene el de otra', () => assert.ok(!one.body.includes('karolynm5')))
check('asunto claro', () => assert.match(one.subject, /Excellent/))
check('el asistente de IA recibe enlace, tutorial, contraseña y la regla de no inventar fechas', () => {
  for (const t of [EXCELLENT_URL, EXCELLENT_TUTORIAL_URL, EXCELLENT_PASSWORD, 'no inventar fechas', 'nunca el de otros estudiantes']) {
    assert.ok(EXCELLENT_FAQ_SECTION.includes(t), t)
  }
  assert.ok(!/@do\.amcoedu\.org/.test(EXCELLENT_FAQ_SECTION), 'el documento general no lleva correos de estudiantes')
})

console.log(`\n${passed} comprobaciones OK`)
