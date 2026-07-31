import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Fuente principal — Inter es la fuente recomendada para este proyecto
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Fuente de despliegue (titulares de marketing) — cálida, con carácter,
// usada con moderación en la landing pública.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});

// Fuente utilitaria (cifras, etiquetas, "eyebrows") — evoca lo técnico
// del sistema, en contraste deliberado con la calidez del display.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MentorIApp — Sistema de Gestión Escolar",
  description:
    "Una experiencia escolar más clara para dirección, secretaría y familias. Trazabilidad, comunicados inteligentes y portal familiar.",
  keywords: ["gestión escolar", "portal familiar", "asistencia", "pagos", "comunicados"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning evita warnings si alguna extensión del navegador inyecta atributos en <body> antes de que React hidrate. */}
      <body suppressHydrationWarning className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
