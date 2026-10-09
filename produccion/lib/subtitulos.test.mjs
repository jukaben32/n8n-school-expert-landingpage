// Pruebas de lib/subtitulos.mjs.   Correr con:  node --test lib/
import test from 'node:test'
import assert from 'node:assert/strict'
import { formatearTiempo, partirEnCues, construirSrt } from './subtitulos.mjs'

test('formatearTiempo usa el formato SRT HH:MM:SS,mmm', () => {
  assert.equal(formatearTiempo(0), '00:00:00,000')
  assert.equal(formatearTiempo(61.5), '00:01:01,500')
  assert.equal(formatearTiempo(3725.042), '01:02:05,042')
})

test('formatearTiempo no redondea a 1000 ms (0.9996 -> 1 s exacto)', () => {
  assert.equal(formatearTiempo(0.9996), '00:00:01,000')
})

test('partirEnCues parte por oraciones y respeta el máximo de caracteres', () => {
  const texto = 'Dos personas compran el mismo pan. La primera lo parte en dos pedazos iguales y se come uno. ¿Quién comió más pan?'
  const cues = partirEnCues(texto, 60)
  assert.ok(cues.length >= 3)
  for (const c of cues) assert.ok(c.length <= 60, `cue demasiado largo: "${c}"`)
  // No se pierde ni se inventa ninguna palabra.
  assert.equal(cues.join(' ').replace(/\s+/g, ' '), texto)
})

test('partirEnCues corta una oración larga en comas o espacios, nunca a media palabra', () => {
  const texto = 'Esta oración no tiene ningún punto intermedio pero es bastante larga, así que hay que cortarla bien'
  const cues = partirEnCues(texto, 40)
  for (const c of cues) assert.ok(c.length <= 40)
  assert.equal(cues.join(' '), texto)
})

test('partirEnCues devuelve [] con texto vacío', () => {
  assert.deepEqual(partirEnCues('   ', 60), [])
})

test('construirSrt numera, encadena escenas y termina cada cue antes de la pausa final', () => {
  const srt = construirSrt(
    [
      { narracion: 'Hola. Adiós.', duracion: 4.5 },
      { narracion: 'Otra escena.', duracion: 2.5 },
    ],
    { pausaFinal: 0.5, maxCaracteres: 60 },
  )
  const bloques = srt.trim().split('\n\n')
  assert.equal(bloques.length, 3)
  assert.match(bloques[0], /^1\n00:00:00,000 --> 00:00:0\d,\d{3}\nHola\.$/)
  // La escena 2 empieza justo cuando termina la 1 (4.5 s).
  assert.match(bloques[2], /^3\n00:00:04,500 --> 00:00:06,500\nOtra escena\.$/)
})

test('construirSrt reparte el tiempo en proporción al largo del texto y nunca se solapa', () => {
  const srt = construirSrt([{ narracion: 'Corto. Una oración bastante más larga que la primera.', duracion: 10.5 }], {
    pausaFinal: 0.5,
    maxCaracteres: 60,
  })
  const tiempos = [...srt.matchAll(/(\d\d):(\d\d):(\d\d),(\d{3}) --> (\d\d):(\d\d):(\d\d),(\d{3})/g)].map((m) => {
    const a = +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000
    const b = +m[5] * 3600 + +m[6] * 60 + +m[7] + +m[8] / 1000
    return [a, b]
  })
  assert.equal(tiempos.length, 2)
  assert.ok(tiempos[0][1] <= tiempos[1][0] + 1e-6, 'los cues no deben solaparse')
  assert.ok(tiempos[1][1] <= 10.0 + 1e-6, 'el último cue termina antes de la pausa final')
  assert.ok(tiempos[1][1] - tiempos[1][0] > tiempos[0][1] - tiempos[0][0], 'el texto largo dura más')
})

test('construirSrt con una escena sin narración no rompe y avanza el reloj', () => {
  const srt = construirSrt(
    [{ narracion: '', duracion: 3 }, { narracion: 'Sigue.', duracion: 2 }],
    { pausaFinal: 0, maxCaracteres: 60 },
  )
  assert.match(srt, /^1\n00:00:03,000 --> 00:00:05,000\nSigue\./)
})

test('partirEnCues no parte un decimal por su punto (3.5 sigue junto)', () => {
  const cues = partirEnCues('Un pan cuesta 3.5 pesos más. Sigue la próxima oración.', 60)
  assert.deepEqual(cues, ['Un pan cuesta 3.5 pesos más.', 'Sigue la próxima oración.'])
})
