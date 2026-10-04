import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Aplica a todas las rutas
        source: "/:path*",
        headers: [
          // Evita que el sitio se cargue dentro de un <iframe> ajeno (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // Evita que el navegador intente adivinar el tipo MIME de un archivo
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No filtra la URL completa de origen al navegar a otro sitio
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Desactiva APIs sensibles del navegador que esta app no usa
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // CSP en modo "solo reportar": no bloquea nada todavia, solo registra en la
          // consola del navegador que se habria bloqueado si fuera estricta. Se agrega
          // asi a proposito (menor radio de impacto) porque esta app usa varios dominios
          // externos en el navegador (Supabase Storage para imagenes, la API Realtime de
          // OpenAI para la llamada de voz via WebRTC, la Pagina de Pago de Azul) que hay
          // que confirmar con datos reales antes de bloquear nada de verdad. Ver AGENTS.md.
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "media-src 'self' https:",
              "frame-src 'self' https://www.youtube.com https://player.vimeo.com",
              "form-action 'self' https://pagos.azul.com.do https://pruebas.azul.com.do",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
