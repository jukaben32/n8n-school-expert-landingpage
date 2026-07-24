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
        ],
      },
    ];
  },
};

export default nextConfig;
