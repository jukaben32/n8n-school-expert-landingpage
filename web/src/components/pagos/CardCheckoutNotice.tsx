import Link from 'next/link'
import CardBrandLogos from './CardBrandLogos'
import { POLICY_LINK_LABELS } from '@/app/colegio/[subdomain]/politicas/contenido'

/**
 * Bloque del checkout (Pagos del Portal Familiar) con lo que Azul exige
 * ver junto al botón de pago: logos de las marcas, sellos 3D Secure,
 * moneda y enlaces a las políticas del colegio.
 */
export default function CardCheckoutNotice({ schoolSubdomain }: { schoolSubdomain: string | null }) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 space-y-3 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Pago seguro con AZUL</p>
      <CardBrandLogos variant="todas" height={26} />
      <p className="text-xs text-slate-600">
        Los montos se cobran en pesos dominicanos (RD$). Los datos de tu tarjeta se escriben en la página
        segura de AZUL; el colegio nunca los ve ni los guarda.
      </p>
      {schoolSubdomain && (
        <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
          {(['reembolsos', 'seguridad', 'privacidad'] as const).map((slug) => (
            <li key={slug}>
              <Link
                href={`/colegio/${schoolSubdomain}/politicas/${slug}`}
                className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
              >
                {POLICY_LINK_LABELS[slug]}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
