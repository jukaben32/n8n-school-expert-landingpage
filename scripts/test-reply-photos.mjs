#!/usr/bin/env node --experimental-strip-types
/**
 * Prueba de las fotos en las respuestas del asistente.
 *
 *   node --experimental-strip-types scripts/test-reply-photos.mjs
 *
 * No toca ninguna base ni API: `replyPhotos.ts` y `familyAssistantPrompt.ts` son puros.
 */
import assert from 'node:assert/strict'
import { splitReplyPhotos, stripReplyPhotos } from '../web/src/lib/ai/replyPhotos.ts'
import { buildFamilyAssistantPrompt } from '../web/src/lib/ai/familyAssistantPrompt.ts'

let passed = 0
function check(name, fn) {
  fn()
  passed += 1
  console.log(`  OK  ${name}`)
}

const FOTO = '/documentos/uniformes-escolares.png'

check('separa el texto de una foto válida', () => {
  const r = splitReplyPhotos(`El uniforme diario es polo blanco.\n[[foto:${FOTO}]]`)
  assert.equal(r.text, 'El uniforme diario es polo blanco.')
  assert.deepEqual(r.photos, [FOTO])
})

check('una respuesta sin marca queda intacta', () => {
  const r = splitReplyPhotos('Hola, todo bien.')
  assert.equal(r.text, 'Hola, todo bien.')
  assert.deepEqual(r.photos, [])
})

check('no repite la misma foto dos veces', () => {
  const r = splitReplyPhotos(`[[foto:${FOTO}]] texto [[foto:${FOTO}]]`)
  assert.deepEqual(r.photos, [FOTO])
})

check('descarta URLs externas, pero nunca deja la marca cruda a la vista', () => {
  const r = splitReplyPhotos('Mire [[foto:https://malo.example/pixel.png]]')
  assert.deepEqual(r.photos, [])
  assert.equal(r.text, 'Mire')
})

check('descarta rutas con ".." y formatos que no son imagen', () => {
  assert.deepEqual(splitReplyPhotos('[[foto:/documentos/../secreto.png]]').photos, [])
  assert.deepEqual(splitReplyPhotos('[[foto:/documentos/normas.pdf]]').photos, [])
  assert.deepEqual(splitReplyPhotos('[[foto:/otra-carpeta/x.png]]').photos, [])
})

check('stripReplyPhotos deja solo el texto (WhatsApp)', () => {
  assert.equal(stripReplyPhotos(`Así es el uniforme.\n[[foto:${FOTO}]]`), 'Así es el uniforme.')
})

const base = { brandLine: 'Colegio X', contextText: 'datos', canNotifySecretaria: true }

check('el prompt del portal explica las fotos', () => {
  assert.match(buildFamilyAssistantPrompt({ ...base, canShowPhotos: true }), /\[\[foto:/)
})

check('el prompt de canales sin imágenes NO menciona fotos', () => {
  assert.doesNotMatch(buildFamilyAssistantPrompt({ ...base, canShowPhotos: false }), /FOTOS:/)
})

console.log(`\n${passed} pruebas OK`)
