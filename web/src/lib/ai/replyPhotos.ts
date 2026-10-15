/**
 * Fotos dentro de las respuestas del asistente. Módulo PURO (sin imports) para poder probarlo.
 *
 * Cómo funciona: el colegio escribe en su FAQ una línea con una marca, por ejemplo
 *   [[foto:/documentos/uniformes-escolares.png]]
 * y el asistente, cuando la pregunta lo amerita, repite esa marca al final de su respuesta.
 * El chat del portal quita la marca del texto y muestra la imagen.
 *
 * Seguridad: la marca la escribe un modelo, así que NUNCA se confía en ella tal cual. Solo se
 * aceptan imágenes propias del sitio (carpeta /documentos/); cualquier otra cosa (otra URL, rutas
 * con "..", otros formatos) se descarta sin mostrar nada.
 */

// Marca bien formada: solo rutas dentro de /documentos/ y solo formatos de imagen.
const VALID_PHOTO_MARKER = /\[\[foto:(\/documentos\/[A-Za-z0-9_\-/.]+\.(?:png|jpe?g|webp))\]\]/gi
// Cualquier marca "[[foto:...]]", válida o no, para que nunca se le muestre cruda a la familia.
const ANY_PHOTO_MARKER = /\[\[foto:[^\]]*\]\]/gi

export interface SplitReply {
  text: string
  photos: string[]
}

export function splitReplyPhotos(reply: string): SplitReply {
  const photos: string[] = []

  for (const match of reply.matchAll(VALID_PHOTO_MARKER)) {
    const path = match[1]
    if (!path.includes('..') && !photos.includes(path)) photos.push(path)
  }

  const text = reply.replace(ANY_PHOTO_MARKER, '').replace(/\n{3,}/g, '\n\n').trim()
  return { text, photos }
}

// Para los canales que todavía no pueden mostrar imágenes (WhatsApp): deja solo el texto.
export function stripReplyPhotos(reply: string): string {
  return splitReplyPhotos(reply).text
}
