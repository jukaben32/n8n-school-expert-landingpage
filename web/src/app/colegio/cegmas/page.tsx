import { redirect } from 'next/navigation'

// Alias corto y sin guiones para la página pública de Centro Educativo Gran
// Manantial de Sabiduría (CEGMAS) -- pedido real: el enlace largo
// (/colegio/gran-manantial-de-sabiduria, 5 guiones seguidos) es propenso a
// que la corrección de puntuación de iOS ("Puntuación inteligente") cambie
// los guiones normales por guiones largos al escribirlo o al pasar por
// WhatsApp/Notas, rompiendo la ruta. Este alias es exclusivo de este
// colegio, no un patrón general de la plataforma.
export default function CegmasAlias() {
  redirect('/colegio/gran-manantial-de-sabiduria')
}
