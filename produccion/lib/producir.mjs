/**
 * Fábrica de video-lecciones estilo Khan Academy.
 *
 *   guion (JSON) -> gráficas por código -> voz -> MP4
 *
 * REGLA NO NEGOCIABLE: todo lo que lleve texto, número o ecuación se dibuja
 * con HTML real (lib/estilo.css). Ningún modelo generativo escribe un dato:
 * una ecuación mal renderizada le enseña mal al estudiante y nadie se entera.
 *
 * Cada escena se narra por separado. Eso permite comparar el transcript
 * devuelto contra el guion palabra por palabra: si la voz se comió una
 * oración -- cosa que sí pasa, y en pruebas le pasó a 3 de 5 voces -- la
 * producción falla ahí en vez de publicar una lección incompleta.
 *
 * Uso:  OPENROUTER_API_KEY=... node lib/producir.mjs lecciones/<archivo>.json
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { chromium } from 'playwright-core'
import ffmpegPath from 'ffmpeg-static'

const run = promisify(execFile)
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const MODELO_VOZ = 'openai/gpt-audio-mini'
/** La voz sale a ~178 palabras/min: muy rápido para un niño. 0.84 la deja en ~150. */
const RITMO = 0.84
/** Silencio al final de cada escena, para que no se sienta atropellada. */
const PAUSA_FINAL = 0.5

const SISTEMA_VOZ = [
  'Eres un narrador de audio. Lee EXACTAMENTE el texto del usuario, palabra por palabra,',
  'completo, desde la primera palabra hasta la última.',
  'NUNCA agregues saludos, comentarios, confirmaciones ni despedidas.',
  'No digas "por supuesto" ni "claro". Empieza directamente con la primera palabra del texto.',
  'Habla en español neutro de República Dominicana, con calma, como una maestra de primaria',
  'explicándole a un niño de once años.',
].join(' ')

const normalizar = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)

/** Una sola llamada a la voz. Devuelve el PCM crudo y lo que dijo de verdad. */
async function pedirVoz(texto, voz) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELO_VOZ, stream: true, modalities: ['text', 'audio'],
      audio: { voice: voz, format: 'pcm16' },
      messages: [{ role: 'system', content: SISTEMA_VOZ }, { role: 'user', content: texto }],
    }),
  })
  if (!res.ok) throw new Error(`voz: HTTP ${res.status} ${await res.text()}`)

  const trozos = []
  let transcript = '', costo = 0, resto = ''
  for await (const bloque of res.body) {
    resto += Buffer.from(bloque).toString()
    const lineas = resto.split('\n')
    resto = lineas.pop() ?? ''
    for (const linea of lineas) {
      if (!linea.startsWith('data: ')) continue
      const carga = linea.slice(6).trim()
      if (carga === '[DONE]') continue
      let d; try { d = JSON.parse(carga) } catch { continue }
      if (d.usage?.cost) costo = d.usage.cost
      for (const c of d.choices ?? []) {
        const a = c.delta?.audio
        if (a?.data) trozos.push(Buffer.from(a.data, 'base64'))
        if (a?.transcript) transcript += a.transcript
      }
    }
  }
  const pcm = Buffer.concat(trozos)
  if (!pcm.length) throw new Error('la voz no devolvió audio')
  const dichas = new Set(normalizar(transcript))
  return { pcm, costo, faltantes: normalizar(texto).filter((p) => !dichas.has(p)) }
}

/** Parte la narración en oraciones, para reintentar por pedazos. */
const enOraciones = (t) => t.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()).filter(Boolean) ?? [t]

/**
 * Narra una escena verificando que se dijo TODO.
 *
 * El modelo de voz es un modelo de chat, así que a veces resume o reordena
 * en vez de leer -- le pasa sobre todo a los textos largos o con listas
 * ("Una:... Dos:... Tres:"). Por eso: hasta 3 intentos completos y, si sigue
 * fallando, se narra oración por oración y se pegan. Una lección incompleta
 * nunca sale de aquí.
 */
async function narrar(texto, voz, destino) {
  let costo = 0

  for (let intento = 1; intento <= 3; intento++) {
    const r = await pedirVoz(texto, voz)
    costo += r.costo
    if (!r.faltantes.length) return { ...(await escribir(r.pcm, destino)), costo, modo: intento === 1 ? 'directa' : `reintento ${intento}` }
  }

  // Último recurso: oración por oración. Cada pedazo es corto, así que la
  // voz no tiene margen para resumir.
  const partes = []
  for (const oracion of enOraciones(texto)) {
    let ok = null
    for (let intento = 1; intento <= 3 && !ok; intento++) {
      const r = await pedirVoz(oracion, voz)
      costo += r.costo
      if (!r.faltantes.length) ok = r.pcm
    }
    if (!ok) throw new Error(`la voz no logró leer completa la oración: "${oracion.slice(0, 60)}..."`)
    partes.push(ok)
  }
  return { ...(await escribir(Buffer.concat(partes), destino)), costo, modo: 'por oraciones' }
}

/** Baja el ritmo a ~150 palabras/min y deja una pausa al final. */
async function escribir(pcm, destino) {
  const crudo = `${destino}.pcm`
  await writeFile(crudo, pcm)
  await run(ffmpegPath, ['-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', crudo,
    '-filter:a', `atempo=${RITMO},apad=pad_dur=${PAUSA_FINAL}`, '-b:a', '128k', destino])
  await rm(crudo)
  return { segundos: pcm.length / (24000 * 2) / RITMO + PAUSA_FINAL }
}

async function main() {
  const guionPath = process.argv[2]
  if (!guionPath) throw new Error('falta el archivo del guion')
  if (!process.env.OPENROUTER_API_KEY) throw new Error('falta OPENROUTER_API_KEY')

  const guion = JSON.parse(await readFile(guionPath, 'utf8'))
  const css = await readFile(path.join(RAIZ, 'lib/estilo.css'), 'utf8')
  const dir = path.join(RAIZ, 'salida', guion.id)
  await mkdir(dir, { recursive: true })

  console.log(`\n${guion.materia} · ${guion.curso}\n${guion.titulo}\n${'─'.repeat(60)}`)

  // 1. Gráficas: HTML real -> PNG. Cada número que se ve, se escribió aquí.
  const navegador = await chromium.launch({ executablePath: CHROME })
  const pagina = await navegador.newPage({ viewport: { width: 1920, height: 1080 } })
  for (const [i, esc] of guion.escenas.entries()) {
    await pagina.setContent(`<style>${css}</style>${esc.visual}`, { waitUntil: 'load' })
    await pagina.screenshot({ path: path.join(dir, `escena-${String(i + 1).padStart(2, '0')}.png`) })
  }
  await navegador.close()
  console.log(`gráficas    ${guion.escenas.length} escenas dibujadas`)

  // 2. Voz, escena por escena, con verificación de fidelidad.
  let costoTotal = 0, duracionTotal = 0
  for (const [i, esc] of guion.escenas.entries()) {
    const n = String(i + 1).padStart(2, '0')
    const mp3 = path.join(dir, `escena-${n}.mp3`)
    if (existsSync(mp3) && !process.env.REHACER_VOZ) { console.log(`voz ${n}      (ya estaba)`); continue }
    const r = await narrar(esc.narracion, guion.voz ?? 'marin', mp3)
    costoTotal += r.costo; duracionTotal += r.segundos
    console.log(`voz ${n}      ${r.segundos.toFixed(1)}s  ✓ completa (${r.modo})`)
  }
  // 3. Montaje: cada escena es imagen fija + su narración; luego se pegan.
  const partes = []
  for (let i = 0; i < guion.escenas.length; i++) {
    const n = String(i + 1).padStart(2, '0')
    const parte = path.join(dir, `parte-${n}.mp4`)
    await run(ffmpegPath, ['-y', '-loop', '1', '-i', path.join(dir, `escena-${n}.png`),
      '-i', path.join(dir, `escena-${n}.mp3`), '-c:v', 'libx264', '-tune', 'stillimage',
      '-vf', 'scale=1920:1080', '-r', '25', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-shortest', parte])
    partes.push(parte)
  }
  const lista = path.join(dir, 'partes.txt')
  await writeFile(lista, partes.map((p) => `file '${p}'`).join('\n'))
  const salida = path.join(dir, `${guion.id}.mp4`)
  await run(ffmpegPath, ['-y', '-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', salida])

  const { stdout } = await run(ffmpegPath, ['-i', salida]).catch((e) => ({ stdout: e.stderr ?? '' }))
  const dur = /Duration: (\d+:\d+:\d+\.\d+)/.exec(stdout)?.[1] ?? `${duracionTotal.toFixed(0)}s`

  console.log(`${'─'.repeat(60)}`)
  console.log(`MP4         ${salida}`)
  console.log(`duración    ${dur}`)
  console.log(`costo voz   US$${costoTotal.toFixed(4)}`)
  console.log(`cuestionario ${guion.cuestionario?.length ?? 0} preguntas\n`)
}

main().catch((e) => { console.error('\n✗', e.message, '\n'); process.exit(1) })
