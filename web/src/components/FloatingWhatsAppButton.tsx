// Botón flotante de WhatsApp, compartido entre el sitio público del colegio
// y el Portal Familiar. Enlaza directo a wa.me (sin widget de chat en la
// página -- ni siquiera el proyecto de referencia tiene uno; WhatsApp
// funciona al revés: la familia le escribe al número real y el asistente
// de IA responde). Solo se debe renderizar cuando el canal está realmente
// conectado y habilitado -- pásale `phoneNumber` ya validado como no-null.
export default function FloatingWhatsAppButton({
  phoneNumber,
  message,
}: {
  phoneNumber: string
  message?: string
}) {
  const digits = phoneNumber.replace(/[^\d]/g, '')
  if (!digits) return null

  const href = `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Escribir por WhatsApp"
      className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:scale-105 hover:shadow-2xl"
    >
      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.28 4.9L2 22l5.25-1.28A9.94 9.94 0 0012.04 22c5.52 0 10-4.48 10-10s-4.48-10-10-10zm0 18.18c-1.6 0-3.15-.43-4.5-1.24l-.32-.19-3.12.76.76-3.03-.21-.33A8.18 8.18 0 013.86 12c0-4.5 3.68-8.18 8.18-8.18 4.5 0 8.18 3.68 8.18 8.18 0 4.5-3.68 8.18-8.18 8.18zm4.48-6.13c-.24-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12-.16.24-.63.79-.78.95-.14.16-.28.18-.53.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.8-.2-.48-.4-.42-.55-.42-.14-.01-.3-.01-.46-.01a.9.9 0 00-.65.3c-.22.24-.85.83-.85 2.02s.87 2.35.99 2.51c.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28z" />
      </svg>
    </a>
  )
}
