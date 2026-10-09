/**
 * Subtítulos (.srt) para las video-lecciones, SIN reconocimiento de voz.
 *
 * La fábrica ya sabe dos cosas exactas de cada escena: el TEXTO que se
 * narró (el guion, verificado palabra por palabra) y su DURACIÓN real. Con
 * eso basta: se parte el texto en frases cortas y se reparte el tiempo de la
 * escena en proporción al largo de cada frase. Así no hace falta Whisper
 * (que descarga ~1 GB y puede "oír" mal una fracción o un número) y el
 * subtítulo es siempre idéntico al guion.
 *
 * Funciones puras: no leen ni escriben archivos, para poder probarlas.
 */

/** Máximo de caracteres por subtítulo: 2 líneas de ~42 es lo legible en pantalla. */
export const MAX_CARACTERES = 84

/** 61.5 -> "00:01:01,500". Se redondea a milisegundos ANTES de separar horas/min/seg. */
export function formatearTiempo(segundos) {
  const totalMs = Math.round(Math.max(0, segundos) * 1000)
  const h = Math.floor(totalMs / 3_600_000)
  const m = Math.floor((totalMs % 3_600_000) / 60_000)
  const s = Math.floor((totalMs % 60_000) / 1000)
  const ms = totalMs % 1000
  const dos = (n) => String(n).padStart(2, '0')
  return `${dos(h)}:${dos(m)}:${dos(s)},${String(ms).padStart(3, '0')}`
}

/** Parte una oración que no cabe: junta palabras hasta el máximo, prefiriendo cortar tras una coma. */
function partirOracionLarga(oracion, max) {
  const cues = []
  let actual = ''
  for (const palabra of oracion.split(/\s+/)) {
    const candidata = actual ? `${actual} ${palabra}` : palabra
    if (candidata.length > max && actual) {
      cues.push(actual)
      actual = palabra
    } else {
      actual = candidata
    }
    // Si ya llevamos la mitad y la palabra termina en coma, es un buen lugar para cortar.
    if (actual.length >= max / 2 && /[,;:]$/.test(palabra)) {
      cues.push(actual)
      actual = ''
    }
  }
  if (actual) cues.push(actual)
  return cues
}

/**
 * Texto -> lista de frases cortas, una por subtítulo. Nunca pierde ni inventa palabras.
 * El punto entre dos dígitos (3.5) es decimal, no fin de oración.
 */
export function partirEnCues(texto, max = MAX_CARACTERES) {
  const oraciones = texto.match(/(?:[^.!?]|(?<=\d)\.(?=\d))+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? []
  return oraciones.flatMap((o) => (o.length <= max ? [o] : partirOracionLarga(o, max)))
}

/**
 * Escenas -> texto .srt.
 *
 * @param {{narracion: string, duracion: number}[]} escenas  duración REAL del audio de cada una
 * @param {{pausaFinal?: number, maxCaracteres?: number}} opciones
 *        pausaFinal: segundos de silencio al final de cada escena (el subtítulo no la ocupa)
 */
export function construirSrt(escenas, { pausaFinal = 0, maxCaracteres = MAX_CARACTERES } = {}) {
  const bloques = []
  let inicioEscena = 0

  for (const { narracion, duracion } of escenas) {
    const cues = partirEnCues(narracion ?? '', maxCaracteres)
    const util = Math.max(0, duracion - pausaFinal)
    const pesoTotal = cues.reduce((suma, c) => suma + c.length, 0)

    let t = inicioEscena
    for (const cue of cues) {
      const fin = t + (util * cue.length) / pesoTotal
      bloques.push(`${bloques.length + 1}\n${formatearTiempo(t)} --> ${formatearTiempo(fin)}\n${cue}`)
      t = fin
    }
    // El reloj avanza SIEMPRE la duración completa, haya o no narración.
    inicioEscena += duracion
  }

  return bloques.length ? `${bloques.join('\n\n')}\n` : ''
}
