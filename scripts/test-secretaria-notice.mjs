#!/usr/bin/env node --experimental-strip-types
/**
 * Prueba del aviso del asistente de IA hacia la secretaría y de su prompt.
 *
 *   node --experimental-strip-types scripts/test-secretaria-notice.mjs
 *
 * No toca ninguna base ni ninguna API: `secretariaNotice.ts` y
 * `familyAssistantPrompt.ts` son puros a propósito. Esto NO prueba qué
 * responde el modelo (eso depende de Claude), prueba lo que sí controlamos:
 * que la entrada del modelo se valide, que el texto que ve la secretaría sea
 * el correcto y que el prompt no prometa algo que el servidor no puede cumplir.
 */
import assert from 'node:assert/strict'
import {
  SECRETARIA_TOOL,
  SECRETARIA_TOOL_NAME,
  parseSecretariaNotice,
  buildSecretariaMessageBody,
  claimsNoticeWasRegistered,
  FALLBACK_NOTICE,
} from '../web/src/lib/ai/secretariaNotice.ts'
import { buildFamilyAssistantPrompt } from '../web/src/lib/ai/familyAssistantPrompt.ts'

let passed = 0
function check(name, fn) {
  fn()
  passed += 1
  console.log(`  OK  ${name}`)
}

console.log('parseSecretariaNotice')

check('acepta un aviso válido y deja el estudiante en null si viene vacío', () => {
  const r = parseSecretariaNotice({ tipo: 'aviso', resumen: 'Fue con el pantalón de deporte.', estudiante: '  ' })
  assert.equal(r.ok, true)
  assert.deepEqual(r.notice, { kind: 'aviso', student: null, summary: 'Fue con el pantalón de deporte.' })
})

check('rechaza un tipo que no existe (el modelo no manda cualquier cosa)', () => {
  assert.equal(parseSecretariaNotice({ tipo: 'urgente', resumen: 'x' }).ok, false)
})

check('rechaza un resumen vacío o de solo espacios', () => {
  assert.equal(parseSecretariaNotice({ tipo: 'solicitud', resumen: '   ' }).ok, false)
})

check('rechaza entradas que no son objeto', () => {
  assert.equal(parseSecretariaNotice(null).ok, false)
  assert.equal(parseSecretariaNotice('aviso').ok, false)
  assert.equal(parseSecretariaNotice(undefined).ok, false)
})

check('colapsa saltos de línea y espacios del resumen', () => {
  const r = parseSecretariaNotice({ tipo: 'aviso', resumen: 'Llega   tarde\n\nhoy' })
  assert.equal(r.notice.summary, 'Llega tarde hoy')
})

check('recorta resúmenes larguísimos', () => {
  const r = parseSecretariaNotice({ tipo: 'aviso', resumen: 'a'.repeat(5000) })
  assert.equal(r.notice.summary.length, 600)
})

console.log('buildSecretariaMessageBody')

check('incluye etiqueta, estudiante, resumen y el mensaje original de la familia', () => {
  const body = buildSecretariaMessageBody(
    { kind: 'aviso', student: 'Carmen Grace', summary: 'Asistió con pantalón de deporte porque el otro se dañó.' },
    'Portal Familiar',
    'Buenos días la niña fue con el pantalón de desporte por que el otro sele daño'
  )
  assert.match(body, /Aviso de la familia/)
  assert.match(body, /Estudiante: Carmen Grace/)
  assert.match(body, /pantalón de deporte porque el otro se dañó/)
  assert.match(body, /Mensaje original \(Portal Familiar\): «Buenos días la niña fue con el pantalón de desporte/)
})

check('omite las líneas que no aplican', () => {
  const body = buildSecretariaMessageBody({ kind: 'solicitud', student: null, summary: 'Pide carta de estudio.' }, 'WhatsApp', '')
  assert.doesNotMatch(body, /Estudiante:/)
  assert.doesNotMatch(body, /Mensaje original/)
  assert.match(body, /Solicitud de la familia/)
})

check('recorta el mensaje original para que no llene la bandeja', () => {
  const body = buildSecretariaMessageBody({ kind: 'aviso', student: null, summary: 'x' }, 'WhatsApp', 'b'.repeat(5000))
  assert.ok(body.length < 800)
})

console.log('claimsNoticeWasRegistered')

// Frases REALES que escribió Claude en la prueba del 2026-10-05 sin haber llamado a la herramienta.
const PROMESAS = [
  'Entendido. Carmen Grace no asistirá hoy porque está enferma. Queda constancia de este aviso en la secretaría.',
  'Le voy a avisar a la secretaría para que le proporcionen esos detalles.',
  'Listo, ya le aviso a la secretaría. Le responderán por Mensajes del portal.',
  'Queda todo registrado en la secretaría.',
  'Perfecto, ya quedó registrado en la secretaría.',
  'La secretaría ha sido notificada.',
  'Ya avisé a la secretaría.',
]
const RESPUESTAS_NORMALES = [
  'La entrada es a las 7:40 a.m.',
  'El uniforme diario es camisa blanca y pantalón/falda azul marino.',
  'Su pago de septiembre está registrado y no tiene saldo pendiente.',
  'No puedo darle consejos médicos. Consulte a su pediatra.',
  'No puedo ayudarle con eso. Solo tengo acceso a la información de su propia familia.',
  'No pude dejar el aviso en la secretaría; por favor comuníquelo directamente.',
  'No se pudo avisar a la secretaría desde este canal.',
]

check('detecta las promesas de aviso reales', () => {
  for (const frase of PROMESAS) assert.equal(claimsNoticeWasRegistered(frase), true, frase)
})

check('no se activa con respuestas normales ni con fallos honestos', () => {
  for (const frase of RESPUESTAS_NORMALES) assert.equal(claimsNoticeWasRegistered(frase), false, frase)
})

check('el aviso de respaldo es un "aviso" sin estudiante', () => {
  assert.equal(FALLBACK_NOTICE.kind, 'aviso')
  assert.equal(FALLBACK_NOTICE.student, null)
})

console.log('SECRETARIA_TOOL')

check('exige tipo y resumen, y el nombre coincide con el que ejecuta el servidor', () => {
  assert.equal(SECRETARIA_TOOL.name, SECRETARIA_TOOL_NAME)
  assert.deepEqual(SECRETARIA_TOOL.input_schema.required, ['tipo', 'resumen'])
  assert.deepEqual(SECRETARIA_TOOL.input_schema.properties.tipo.enum, ['aviso', 'solicitud'])
})

console.log('buildFamilyAssistantPrompt')

const base = { brandLine: 'Colegio de Prueba', contextText: 'Familia: Los Pérez' }

check('con forma de avisar: manda usar la herramienta y NO derivar por un simple aviso', () => {
  const p = buildFamilyAssistantPrompt({ ...base, canNotifySecretaria: true })
  assert.match(p, /avisar_secretaria/)
  assert.match(p, /Nunca la mandes a la secretaría por algo que solo está informando/)
  assert.match(p, /SOLO después de que la herramienta confirme/)
})

check('sin forma de avisar: no menciona la herramienta ni promete avisar', () => {
  const p = buildFamilyAssistantPrompt({ ...base, canNotifySecretaria: false })
  assert.doesNotMatch(p, /avisar_secretaria/)
  assert.match(p, /NO tienes forma de avisar a la secretaría/)
})

check('en ambos casos: no inventa plazos y no deriva "si no está en los datos"', () => {
  for (const canNotifySecretaria of [true, false]) {
    const p = buildFamilyAssistantPrompt({ ...base, canNotifySecretaria })
    assert.match(p, /No inventes políticas, plazos ni sanciones/)
    assert.doesNotMatch(p, /sugiere contactar a la secretar/)
  }
})

check('en ambos casos conserva el aislamiento entre familias y los datos del contexto', () => {
  for (const canNotifySecretaria of [true, false]) {
    const p = buildFamilyAssistantPrompt({ ...base, canNotifySecretaria })
    assert.match(p, /Nunca reveles, menciones ni compares con datos de otras familias/)
    assert.match(p, /DATOS DE LA FAMILIA:\nFamilia: Los Pérez/)
    assert.match(p, /Colegio de Prueba/)
  }
})

console.log(`\n${passed} comprobaciones OK`)
