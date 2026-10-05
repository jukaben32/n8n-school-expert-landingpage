#!/usr/bin/env node --experimental-strip-types
/**
 * Prueba del ciclo de herramientas (tool use) del cliente de Anthropic.
 *
 *   node --experimental-strip-types scripts/test-claude-tool-loop.mjs
 *
 * Usa un `fetch` SIMULADO: no llama a Anthropic ni gasta nada. Prueba la lógica
 * nuestra del ciclo -- que el resultado de la herramienta vuelva al modelo con el
 * formato que la API exige, que el ciclo tenga tope y que los errores no se
 * traguen. Lo que NO puede probar es que la API real acepte esos mensajes.
 */
import assert from 'node:assert/strict'
import { callClaude } from '../web/src/lib/ai/claudeMessages.ts'

let passed = 0
async function check(name, fn) {
  await fn()
  passed += 1
  console.log(`  OK  ${name}`)
}

// Arma un fetch falso que devuelve las respuestas en orden y guarda cada petición.
function fakeFetch(responses) {
  const requests = []
  const impl = async (_url, init) => {
    requests.push(JSON.parse(init.body))
    const next = responses[requests.length - 1]
    if (!next) throw new Error('El ciclo hizo más peticiones de las esperadas.')
    const status = next.status ?? 200
    return { ok: status < 400, status, json: async () => next.body, text: async () => JSON.stringify(next.body ?? '') }
  }
  return { impl, requests }
}

const text = (t) => ({ content: [{ type: 'text', text: t }], stop_reason: 'end_turn' })
const toolUse = (id, input) => ({
  content: [{ type: 'text', text: 'Voy a avisar.' }, { type: 'tool_use', id, name: 'avisar_secretaria', input }],
  stop_reason: 'tool_use',
})

const base = (extra) => ({
  apiKey: 'clave-falsa-de-prueba',
  model: 'modelo-de-prueba',
  maxOutputTokens: 100,
  maxToolRounds: 3,
  system: 'sistema',
  messages: [{ role: 'user', content: 'hola' }],
  ...extra,
})

const handler = (runImpl) => ({ tools: [{ name: 'avisar_secretaria' }], run: runImpl })

console.log('callClaude')

await check('sin herramientas: una sola petición y no manda `tools`', async () => {
  const { impl, requests } = fakeFetch([{ body: text('Hola, ¿en qué le ayudo?') }])
  const reply = await callClaude(base({ fetchImpl: impl }))
  assert.equal(reply, 'Hola, ¿en qué le ayudo?')
  assert.equal(requests.length, 1)
  assert.equal('tools' in requests[0], false)
})

await check('con herramienta: ejecuta, devuelve el tool_result con el mismo id y entrega el texto final', async () => {
  const { impl, requests } = fakeFetch([
    { body: toolUse('toolu_1', { tipo: 'aviso', resumen: 'Pantalón de deporte' }) },
    { body: text('Anotado, ya le avisé a la secretaría.') },
  ])
  const llamadas = []
  const reply = await callClaude(
    base({
      fetchImpl: impl,
      toolHandler: handler(async (name, input) => {
        llamadas.push({ name, input })
        return { ok: true, message: 'Aviso registrado.' }
      }),
    })
  )

  assert.equal(reply, 'Anotado, ya le avisé a la secretaría.')
  assert.deepEqual(llamadas, [{ name: 'avisar_secretaria', input: { tipo: 'aviso', resumen: 'Pantalón de deporte' } }])
  assert.equal(requests.length, 2)

  // La segunda petición lleva: el turno original, lo que dijo el modelo (con su tool_use) y el resultado.
  const second = requests[1].messages
  assert.equal(second.length, 3)
  assert.equal(second[1].role, 'assistant')
  assert.equal(second[1].content.find((b) => b.type === 'tool_use').id, 'toolu_1')
  assert.deepEqual(second[2], { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'Aviso registrado.' }] })
  // Mientras haya tool_use/tool_result en la conversación, `tools` debe seguir declarado.
  assert.ok(requests[1].tools)
})

await check('si la herramienta falla, el modelo recibe is_error y puede decírselo a la familia', async () => {
  const { impl, requests } = fakeFetch([
    { body: toolUse('toolu_9', { tipo: 'aviso', resumen: 'x' }) },
    { body: text('No pude dejar el aviso; comuníquese con la secretaría.') },
  ])
  const reply = await callClaude(base({ fetchImpl: impl, toolHandler: handler(async () => ({ ok: false, message: 'No se pudo registrar.' })) }))
  assert.match(reply, /No pude dejar el aviso/)
  assert.equal(requests[1].messages[2].content[0].is_error, true)
})

await check('tope de vueltas: si el modelo insiste, la última petición prohíbe herramientas', async () => {
  const insiste = toolUse('t', { tipo: 'aviso', resumen: 'x' })
  const { impl, requests } = fakeFetch([{ body: insiste }, { body: insiste }, { body: text('Listo.') }])
  const reply = await callClaude(base({ maxToolRounds: 2, fetchImpl: impl, toolHandler: handler(async () => ({ ok: true, message: 'ok' })) }))
  assert.equal(reply, 'Listo.')
  assert.equal(requests.length, 3)
  assert.equal(requests[0].tool_choice, undefined)
  assert.deepEqual(requests[2].tool_choice, { type: 'none' })
})

await check('si en la última vuelta aún pide herramienta, falla: su "voy a avisar" no es una respuesta', async () => {
  const insiste = toolUse('t', { tipo: 'aviso', resumen: 'x' })
  const { impl } = fakeFetch([{ body: insiste }, { body: insiste }])
  await assert.rejects(
    callClaude(base({ maxToolRounds: 1, fetchImpl: impl, toolHandler: handler(async () => ({ ok: true, message: 'ok' })) })),
    /no devolvió una respuesta final/
  )
})

await check('no muta el arreglo de mensajes del llamador', async () => {
  const { impl } = fakeFetch([{ body: toolUse('a', { tipo: 'aviso', resumen: 'x' }) }, { body: text('ok') }])
  const original = [{ role: 'user', content: 'hola' }]
  await callClaude(base({ messages: original, fetchImpl: impl, toolHandler: handler(async () => ({ ok: true, message: 'ok' })) }))
  assert.equal(original.length, 1)
})

// Caso REAL visto con Claude (7 de 31 pruebas): tras el resultado de la herramienta, el modelo devuelve
// una respuesta VACÍA. El aviso ya se registró; sin reintento, la familia vería un error.
await check('respuesta vacía tras usar la herramienta: reintenta UNA vez pidiendo responder', async () => {
  const { impl, requests } = fakeFetch([
    { body: toolUse('toolu_7', { tipo: 'aviso', resumen: 'x' }) },
    { body: { content: [], stop_reason: 'end_turn' } },
    { body: text('Listo, quedó avisado a la secretaría.') },
  ])
  const reply = await callClaude(base({ fetchImpl: impl, toolHandler: handler(async () => ({ ok: true, message: 'ok' })) }))
  assert.equal(reply, 'Listo, quedó avisado a la secretaría.')
  assert.equal(requests.length, 3)
  // El reintento va en el MISMO turno del tool_result (primero el resultado, después el texto).
  const retryUser = requests[2].messages[2]
  assert.equal(retryUser.content[0].type, 'tool_result')
  assert.equal(retryUser.content[retryUser.content.length - 1].type, 'text')
  assert.equal(requests[2].messages.length, 3)
})

await check('si sigue vacía tras el reintento, falla (no se reintenta en bucle)', async () => {
  const vacia = { body: { content: [], stop_reason: 'end_turn' } }
  const { impl, requests } = fakeFetch([{ body: toolUse('t', { tipo: 'aviso', resumen: 'x' }) }, vacia, vacia])
  await assert.rejects(
    callClaude(base({ fetchImpl: impl, toolHandler: handler(async () => ({ ok: true, message: 'ok' })) })),
    /sin contenido de texto/
  )
  assert.equal(requests.length, 3)
})

await check('sin haber usado herramientas, una respuesta vacía NO se reintenta', async () => {
  const { impl, requests } = fakeFetch([{ body: { content: [], stop_reason: 'end_turn' } }])
  await assert.rejects(callClaude(base({ fetchImpl: impl, toolHandler: handler(async () => ({ ok: true, message: 'ok' })) })), /sin contenido de texto/)
  assert.equal(requests.length, 1)
})

await check('error de la API: lanza con el código HTTP', async () => {
  const { impl } = fakeFetch([{ status: 400, body: { error: 'credit balance is too low' } }])
  await assert.rejects(callClaude(base({ fetchImpl: impl })), /Anthropic API respondió 400/)
})

await check('respuesta sin texto: lanza en vez de devolver vacío', async () => {
  const { impl } = fakeFetch([{ body: { content: [], stop_reason: 'end_turn' } }])
  await assert.rejects(callClaude(base({ fetchImpl: impl })), /sin contenido de texto/)
})

console.log(`\n${passed} comprobaciones OK`)
