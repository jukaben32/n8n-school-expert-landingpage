/**
 * Solo las gráficas: láminas y dibujos del cuestionario, SIN voz.
 *
 * Existe para poder revisar cómo se ve una lección antes de gastar una sola
 * llamada de voz. `producir.mjs` hace exactamente lo mismo en su primer paso
 * y después narra; esto se queda en el primer paso.
 *
 * Uso:  node lib/render-laminas.mjs lecciones/<archivo>.json
 */
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const g = JSON.parse(await readFile(process.argv[2], 'utf8'))
const css = await readFile(path.join(RAIZ, 'lib', g.estilo ?? 'estilo.css'), 'utf8')
const dir = path.join(RAIZ, 'salida', g.id); await mkdir(dir, { recursive: true })
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
for (const [i, e] of g.escenas.entries()) {
  await p.setContent(`<style>${css}</style>${e.visual}`, { waitUntil: 'load' })
  await p.screenshot({ path: path.join(dir, `escena-${String(i+1).padStart(2,'0')}.png`) })
}
const c = await b.newPage({ viewport: { width: 600, height: 600 } })
let n = 0
for (const [i, q] of (g.cuestionario ?? []).entries())
  for (const [j, o] of (q.opciones ?? []).entries()) {
    if (typeof o !== 'object' || !o.visual) continue
    await c.setContent(`<style>${css}</style><body class="opcion-sola">${o.visual}</body>`, { waitUntil: 'load' })
    await c.screenshot({ path: path.join(dir, `opcion-${i+1}-${j+1}.png`) }); n++
  }
await b.close()
console.log(`${g.escenas.length} escenas + ${n} opciones -> salida/${g.id}/`)
