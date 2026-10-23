import Image from 'next/image'

// Archivos oficiales enviados por Azul (web/public/marcas). "Visa Secure" es
// el nombre actual del sello que antes se llamaba "Verified by Visa".
const BRANDS = {
  visa: { src: '/marcas/visa.png', alt: 'Visa', width: 494, height: 160 },
  mastercard: { src: '/marcas/mastercard.png', alt: 'Mastercard', width: 206, height: 160 },
  visaSecure: { src: '/marcas/visa-secure.png', alt: 'Visa Secure', width: 160, height: 160 },
  idCheck: { src: '/marcas/mastercard-id-check.png', alt: 'Mastercard ID Check', width: 160, height: 160 },
} as const

type BrandKey = keyof typeof BRANDS

// 'marcas' = tarjetas aceptadas; 'seguridad' = sellos 3D Secure; 'todas' = ambos.
const VARIANTS: Record<'marcas' | 'seguridad' | 'todas', BrandKey[]> = {
  marcas: ['visa', 'mastercard'],
  seguridad: ['visaSecure', 'idCheck'],
  todas: ['visa', 'mastercard', 'visaSecure', 'idCheck'],
}

export default function CardBrandLogos({ variant = 'todas', height = 32, className = '' }: {
  variant?: keyof typeof VARIANTS
  height?: number
  className?: string
}) {
  return (
    <ul className={`flex flex-wrap items-center justify-center gap-3 ${className}`} aria-label="Tarjetas y sellos de seguridad aceptados">
      {VARIANTS[variant].map((key) => {
        const brand = BRANDS[key]
        // Se respeta la proporción de cada logo; el fondo blanco es parte
        // de los archivos oficiales, así que se presentan sobre una ficha blanca.
        return (
          <li key={key} className="rounded-md bg-white px-2 py-1 border border-slate-200">
            <Image
              src={brand.src}
              alt={brand.alt}
              width={Math.round((brand.width / brand.height) * height)}
              height={height}
              style={{ height, width: 'auto' }}
            />
          </li>
        )
      })}
    </ul>
  )
}
