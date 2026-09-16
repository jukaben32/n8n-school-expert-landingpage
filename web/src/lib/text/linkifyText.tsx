import type { ReactNode } from 'react'

// Convierte URLs sueltas dentro de un texto plano en enlaces clicables.
// Se usa donde el contenido viene de un textarea libre (comunicados,
// mensajes directos, etc.) y nunca ha pasado por un editor de texto
// enriquecido -- sin esto, un enlace pegado en un comunicado se muestra
// como texto plano y cada familia tiene que copiarlo o teclearlo a mano
// en el navegador, con el riesgo real de un error de tecleo.
const URL_PATTERN = /https?:\/\/[^\s<>"']+/g

// Puntuación de cierre de oración que puede quedar pegada al final de la
// URL (".", ",", ")", etc.) -- se recorta del enlace y se deja como texto
// normal después, para no romper el destino con caracteres que no son
// parte de la dirección.
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/

export function linkifyText(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  URL_PATTERN.lastIndex = 0
  while ((match = URL_PATTERN.exec(text)) !== null) {
    const start = match.index
    let url = match[0]
    let end = start + url.length

    const trailingMatch = url.match(TRAILING_PUNCTUATION)
    if (trailingMatch) {
      url = url.slice(0, url.length - trailingMatch[0].length)
      end -= trailingMatch[0].length
    }
    if (!url) continue

    if (start > lastIndex) parts.push(text.slice(lastIndex, start))
    parts.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="underline font-medium break-all"
      >
        {url}
      </a>
    )
    lastIndex = end
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}
