/**
 * Anota el enlace de YouTube de una lección, identificándola sola.
 *
 * No hay que decirle a cuál lección pertenece: consulta el título real del
 * video en el endpoint oembed de YouTube (que responde aunque el video sea
 * no listado) y lo calza contra el título del guion. Eso cubre el riesgo
 * silencioso de este paso -- un enlace cruzado no da ningún error, solo le
 * muestra al estudiante el video equivocado.
 *
 * Uso:  node lib/anotar-enlace.mjs https://youtu.be/XXXX [https://youtu.be/YYYY ...]
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const rutaEnlaces = path.join(RAIZ, 'enlaces.json')
const enlaces = JSON.parse(await readFile(rutaEnlaces, 'utf8'))

const guiones = []
for (const f of (await readdir(path.join(RAIZ, 'lecciones'))).filter((f) => f.endsWith('.json')).sort()) {
  guiones.push(JSON.parse(await readFile(path.join(RAIZ, 'lecciones', f), 'utf8')))
}

for (const url of process.argv.slice(2)) {
  const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
  if (!res.ok) { console.log(`✗ ${url}: YouTube responde ${res.status}`); continue }
  const { title } = await res.json()
  const g = guiones.find((g) => title.toLowerCase().includes(g.titulo.toLowerCase()))
  if (!g) { console.log(`✗ ${url}: "${title}" no calza con ninguna lección`); continue }
  if (enlaces[g.id] && enlaces[g.id] !== url) console.log(`  ⚠ ${g.id} ya tenía otro enlace, se reemplaza`)
  enlaces[g.id] = url
  console.log(`✅ ${g.id.replace('6to-primaria-', '')}  ${title}`)
}

await writeFile(rutaEnlaces, JSON.stringify(enlaces, null, 2) + '\n')
const listos = Object.values(enlaces).filter(Boolean).length
console.log(`\n${listos} de ${Object.keys(enlaces).length} con enlace`)
for (const [k, v] of Object.entries(enlaces)) console.log(`  ${v ? '✅' : '⏳'} ${k.replace('6to-primaria-', '')}`)
