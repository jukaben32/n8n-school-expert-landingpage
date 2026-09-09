/**
 * Genera la hoja con título y descripción de cada video, lista para copiar y
 * pegar al subirlo a YouTube. Es el paso que conecta la fábrica con el canal:
 * el colegio sube el MP4 (como NO LISTADO) y pega estos dos campos.
 *
 * Después, los enlaces que devuelva YouTube se anotan en `enlaces.json` y
 * `lib/cargar-sql.mjs` genera el SQL que mete las lecciones en Academia.
 *
 * Uso:  node lib/para-youtube.mjs 1ro > PARA_SUBIR_A_YOUTUBE.md
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const filtro = process.argv[2] ?? ''
const COLEGIO = 'Centro Educativo Gran Manantial de Sabiduría'

const archivos = (await readdir(path.join(RAIZ, 'lecciones')))
  .filter((f) => f.endsWith('.json') && f.startsWith(filtro)).sort()

const enlaces = JSON.parse(await readFile(path.join(RAIZ, 'enlaces.json'), 'utf8'))
const porMateria = new Map()
for (const a of archivos) {
  const g = JSON.parse(await readFile(path.join(RAIZ, 'lecciones', a), 'utf8'))
  if (!porMateria.has(g.materia)) porMateria.set(g.materia, [])
  porMateria.get(g.materia).push(g)
}

console.log(`# Videos listos para subir a YouTube\n`)
console.log(`**Súbelos como NO LISTADOS.** Son ${archivos.length} videos.\n`)
console.log(`Para cada uno: copia el **título** y la **descripción** de abajo. Cuando`)
console.log(`tengas los enlaces, pásamelos y los anoto en \`enlaces.json\`; de ahí sale`)
console.log(`el SQL que los publica en Academia con su cuestionario.\n`)
console.log(`> **La casilla "¿es contenido para niños?" se contesta con la verdad**, no`)
console.log(`> por conveniencia: es una obligación legal (COPPA), no una preferencia.`)
console.log(`> Estas lecciones son para estudiantes de primaria, así que van marcadas`)
console.log(`> como contenido para niños. Eso apaga comentarios y anuncios`)
console.log(`> personalizados, cosa que aquí da igual: **son NO LISTADOS y viven`)
console.log(`> dentro de Academia**, no en el canal público. La estrategia de`)
console.log(`> monetización del canal es otra cosa -- una selección dirigida a padres`)
console.log(`> y maestros, no a niños (ver la sección de YouTube en AGENTS.md).\n`)
console.log(`---\n`)

for (const [materia, lecciones] of porMateria) {
  console.log(`## ${materia}\n`)
  for (const g of lecciones) {
    const mp4 = path.join(RAIZ, 'salida', g.id, `${g.id}.mp4`)
    let peso = 'sin producir'
    if (existsSync(mp4)) peso = `${((await stat(mp4)).size / 1048576).toFixed(1)} MB`
    console.log(`### ${g.unidad ?? ''} — ${g.titulo}\n`)
    console.log(`**Título:**\n\n    ${g.titulo} · ${g.materia} · 1ro de Primaria\n`)
    console.log(`**Descripción:**\n`)
    console.log(`    ${g.descripcion}`)
    console.log(`    `)
    console.log(`    ${g.unidad ?? ''} · ${g.materia} · 1ro de Primaria`)
    console.log(`    ${COLEGIO}`)
    console.log(`    `)
    console.log(`    Video-lección de la plataforma MentorIApp. Al terminar, el`)
    console.log(`    estudiante contesta ${g.cuestionario.length} preguntas dentro de la plataforma.\n`)
    console.log(`**Archivo:** \`produccion/salida/${g.id}/${g.id}.mp4\` (${peso})`)
    console.log(`**Enlace:** ${enlaces[g.id] ?? '_pendiente de subir_'}\n`)
  }
}
