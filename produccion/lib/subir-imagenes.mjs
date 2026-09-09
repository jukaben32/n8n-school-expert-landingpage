/**
 * Sube al bucket privado `academia-imagenes` los dibujos de las opciones del
 * cuestionario que dejó `producir.mjs` en `salida/<id>/opcion-<p>-<o>.png`.
 *
 * La ruta que se guarda en `quiz_options.image_path` es `<id>/opcion-P-O.png`,
 * exactamente la que arma `cargar-sql.mjs`. Las dos tienen que coincidir: si
 * no, la app no encuentra el dibujo y la opción se pinta como texto -- que no
 * rompe nada, pero deja la lección de 1ro sin su parte visual.
 *
 * El bucket es privado a propósito (se lee siempre por signed URL de corta
 * duración desde el servidor), así que esto necesita la service_role key, no
 * la anon.
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node lib/subir-imagenes.mjs                # todas las lecciones de salida/
 *   node lib/subir-imagenes.mjs 1ro-primaria-naturales-u01-01   # solo una
 */
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const BUCKET = 'academia-imagenes'

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const LLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !LLAVE) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

/** Sube un PNG. `upsert` para poder rehacer un dibujo y volver a subirlo. */
async function subir(rutaLocal, rutaRemota) {
  const cuerpo = await readFile(rutaLocal)
  const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${rutaRemota}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LLAVE}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: cuerpo,
  })
  if (!res.ok) throw new Error(`${rutaRemota}: HTTP ${res.status} ${await res.text()}`)
}

const soloEsta = process.argv[2]
const lecciones = (await readdir(path.join(RAIZ, 'lecciones')))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .filter((id) => !soloEsta || id === soloEsta)

if (!lecciones.length) {
  console.error(soloEsta ? `No existe la lección ${soloEsta}` : 'No hay lecciones')
  process.exit(1)
}

let subidas = 0, sinDibujo = 0
for (const id of lecciones) {
  const guion = JSON.parse(await readFile(path.join(RAIZ, 'lecciones', `${id}.json`), 'utf8'))
  for (const [i, preg] of (guion.cuestionario ?? []).entries()) {
    for (const [j, op] of (preg.opciones ?? []).entries()) {
      if (typeof op !== 'object' || !op.visual) continue
      const nombre = `opcion-${i + 1}-${j + 1}.png`
      const local = path.join(RAIZ, 'salida', id, nombre)
      if (!existsSync(local)) {
        // El guion pide dibujo pero nadie lo produjo todavía. Se avisa en vez
        // de subir a medias: `image_path` apuntaría a un archivo inexistente
        // y la opción se vería vacía.
        console.error(`⚠ falta producir ${id}/${nombre} -- corre producir.mjs primero`)
        sinDibujo++
        continue
      }
      await subir(local, `${id}/${nombre}`)
      subidas++
    }
  }
  console.log(`${id}  ✓`)
}

console.log(`\n${subidas} dibujos subidos a ${BUCKET}${sinDibujo ? ` · ${sinDibujo} sin producir` : ''}`)
if (sinDibujo) process.exit(1)
