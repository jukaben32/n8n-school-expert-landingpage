import Link from 'next/link'
import CardBrandLogos from '@/components/pagos/CardBrandLogos'
import { POLICY_LINK_LABELS, POLICY_SLUGS, addressWithCountry } from './politicas/contenido'

/**
 * Franja legal del pie de página del sitio del colegio: enlaces a las
 * políticas, moneda, dirección con país y (si el colegio acepta tarjeta)
 * los logos de Visa/Mastercard y los sellos 3D Secure -- todo lo que Azul
 * exige ver en la página principal del comercio.
 */
export default function SchoolLegalFooter({ subdomain, address, showCardBrands }: {
  subdomain: string
  address: string | null
  showCardBrands: boolean
}) {
  const fullAddress = addressWithCountry(address)
  return (
    <div className="w-full max-w-3xl mx-auto space-y-4 text-slate-600">
      {showCardBrands && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-slate-500">Pagos seguros con</p>
          <CardBrandLogos variant="todas" height={28} />
        </div>
      )}
      <nav aria-label="Políticas del colegio">
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
          {POLICY_SLUGS.map((slug) => (
            <li key={slug}>
              <Link
                href={`/colegio/${subdomain}/politicas/${slug}`}
                className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
              >
                {POLICY_LINK_LABELS[slug]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="text-xs">Todos los pagos se realizan en pesos dominicanos (RD$ / DOP).</p>
      {fullAddress && <p className="text-xs">{fullAddress}</p>}
    </div>
  )
}
