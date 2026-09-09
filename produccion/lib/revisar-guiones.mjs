/**
 * Revisa los guiones ANTES de producirlos.
 *
 * Producir cuesta tiempo y llamadas de voz; una lección con una escena sin
 * lámina, o con `correcta` apuntando a una opción que no existe, se descubre
 * cuando ya está el MP4 hecho. Esto lo caza antes, en un segundo.
 *
 * Lo que comprueba:
 *   - El curso, en el texto EXACTO que tiene `students.grade_level` -- si no
 *     calza carácter por carácter, el estudiante no ve la lección y nadie
 *     recibe ningún error (la trampa #4 de AGENTS.md).
 *   - Que las lecciones de 1ro usen la plantilla y el ritmo de 1ro.
 *   - Que ninguna escena quede sin lámina ni con una narración larguísima.
 *   - Que el cuestionario esté completo y `correcta` esté dentro de rango.
 *   - Que la respuesta correcta NO caiga siempre en la misma posición: un
 *     niño saca 100% tocando siempre la primera. Las 36 preguntas de 6to
 *     tienen `correcta: 0` -- por eso existe esta comprobación.
 *
 * Uso:  node lib/revisar-guiones.mjs            # todos
 *       node lib/revisar-guiones.mjs 1ro        # los que empiecen con "1ro"
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const filtro = process.argv[2] ?? ''
const MATERIAS = ['Lengua Española', 'Matemática', 'Ciencias Naturales', 'Ciencias Sociales']
/** Palabras por minuto a las que queda la voz de 1ro con ritmo 0.76. */
const PPM = 130

const archivos = (await readdir(path.join(RAIZ, 'lecciones')))
  .filter((f) => f.endsWith('.json') && f.startsWith(filtro))
  .sort()

let problemas = 0
const posiciones = {}

for (const archivo of archivos) {
  const g = JSON.parse(await readFile(path.join(RAIZ, 'lecciones', archivo), 'utf8'))
  const err = []
  const esPrimero = g.curso === '1ro. Primaria'

  if (g.id !== archivo.replace(/\.json$/, '')) err.push('el id no coincide con el nombre del archivo')
  if (!MATERIAS.includes(g.materia)) err.push(`materia desconocida: "${g.materia}"`)
  if (!/^(1ro|2do|3ro|4to|5to|6to)\. (Primaria|Secundaria)$/.test(g.curso)) {
    err.push(`curso "${g.curso}" no tiene la forma de students.grade_level`)
  }
  if (esPrimero) {
    if (g.estilo !== 'estilo-inicial.css') err.push('1ro debe usar estilo-inicial.css')
    if (g.ritmo !== 0.76) err.push(`1ro debe ir a ritmo 0.76 (tiene ${g.ritmo})`)
    if (g.edad !== 6) err.push(`1ro debe declarar edad 6 (tiene ${g.edad})`)
  }

  g.escenas.forEach((e, i) => {
    if (!e.visual?.trim()) err.push(`escena ${i + 1}: sin lámina`)
    if (!e.narracion?.trim()) err.push(`escena ${i + 1}: sin narración`)
    const palabras = (e.narracion ?? '').trim().split(/\s+/).length
    // Una escena muy larga cansa al niño y además es la que más se le come
    // al modelo de voz (por eso `producir.mjs` tiene reintentos).
    if (palabras > (esPrimero ? 75 : 120)) err.push(`escena ${i + 1}: ${palabras} palabras, demasiado larga`)
  })

  g.cuestionario?.forEach((q, i) => {
    if (!q.pregunta?.trim()) err.push(`pregunta ${i + 1}: sin enunciado`)
    if (!Array.isArray(q.opciones) || q.opciones.length < 2) err.push(`pregunta ${i + 1}: menos de 2 opciones`)
    if (typeof q.correcta !== 'number' || q.correcta < 0 || q.correcta >= (q.opciones?.length ?? 0)) {
      err.push(`pregunta ${i + 1}: "correcta" fuera de rango`)
    }
    q.opciones?.forEach((o, j) => {
      // En 1ro toda opción necesita dibujo: el niño contesta tocando, no leyendo.
      if (esPrimero && (typeof o !== 'object' || !o.visual)) err.push(`pregunta ${i + 1}, opción ${j + 1}: sin dibujo`)
      if (typeof o === 'object' && !o.texto) err.push(`pregunta ${i + 1}, opción ${j + 1}: sin texto`)
    })
    posiciones[q.correcta] = (posiciones[q.correcta] ?? 0) + 1
  })

  const distintas = new Set((g.cuestionario ?? []).map((q) => q.correcta))
  if ((g.cuestionario?.length ?? 0) > 2 && distintas.size === 1) {
    err.push(`todas las respuestas correctas en la posición ${[...distintas][0] + 1}`)
  }

  const palabras = g.escenas.reduce((s, e) => s + (e.narracion ?? '').split(/\s+/).length, 0)
  console.log(
    `${err.length ? '✗' : '✓'} ${g.id.padEnd(34)} ${String(g.escenas.length).padStart(2)} esc · ` +
    `${String(palabras).padStart(3)} pal · ~${(palabras / PPM).toFixed(1)} min · ${g.cuestionario?.length ?? 0} preg`
  )
  err.forEach((e) => { console.log(`    ✗ ${e}`); problemas++ })
}

console.log(`\n${archivos.length} lecciones · ${problemas} problema${problemas === 1 ? '' : 's'}`)

// Sesgo de conjunto: si la mitad de las respuestas cae siempre en el mismo
// botón, adivinar paga demasiado aunque ninguna lección suelta esté mal.
const total = Object.values(posiciones).reduce((a, b) => a + b, 0)
if (total) {
  const reparto = Object.entries(posiciones).map(([p, n]) => `${+p + 1}ª: ${n}`).join(' · ')
  const mayor = Math.max(...Object.values(posiciones))
  console.log(`posición de la respuesta correcta → ${reparto}`)
  if (mayor / total > 0.5) {
    console.log(`⚠ el ${Math.round((mayor / total) * 100)}% cae en la misma posición: conviene repartirlas más`)
  }
}

process.exit(problemas ? 1 : 0)
