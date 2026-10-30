import Link from 'next/link'
import CardBrandLogos from './CardBrandLogos'
import { createPublicClient } from '@/lib/supabase/publicClient'
import { schoolShowsCardBrands } from '@/lib/payments/cardBrands'
import { POLICY_LINK_LABELS, POLICY_SLUGS, addressWithCountry } from '@/app/colegio/[subdomain]/politicas/contenido'

/**
 * Pie legal del Portal Familiar: logos de Visa/Mastercard, sellos 3D Secure,
 * moneda, dirección con país y enlaces a las políticas del colegio.
 *
 * Los padres entran por el enlace del colegio, no por la página web, así que
 * esto tiene que estar DENTRO del portal -- es lo que le da certeza al padre
 * de que el pago es seguro y lo que Azul revisa. Se muestra siempre (no solo
 * cuando hay facturas pendientes ni solo para quien ve el botón de tarjeta).
 * Solo lectura: no escribe nada ni toca el flujo de pago.
 */
export default async function PortalLegalFooter({ schoolId }: { schoolId: string | null | undefined }) {
  if (!schoolId) return null
  const { data } = await createPublicClient()
    .from('schools_public')
    .select('name, subdomain, address')
    .eq('id', schoolId)
    .maybeSingle()
  const school = data as { name: string; subdomain: string | null; address: string | null } | null
  if (!school?.subdomain) return null

  const showBrands = await schoolShowsCardBrands(schoolId, school.subdomain)
  const fullAddress = addressWithCountry(school.address)

  return (
    <footer className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 space-y-3 text-center text-slate-600">
      {showBrands && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Pagos seguros con AZUL</p>
          <CardBrandLogos variant="todas" height={26} />
        </div>
      )}
      <nav aria-label="Políticas del colegio">
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
          {POLICY_SLUGS.map((slug) => (
            <li key={slug}>
              <Link
                href={`/colegio/${school.subdomain}/politicas/${slug}`}
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
      <p className="text-xs">Los datos de tu tarjeta se escriben en la página segura de AZUL; el colegio nunca los ve ni los guarda.</p>
    </footer>
  )
}
