/**
 * Textos de las políticas que Azul exige ver en el sitio del comercio
 * (correo de Azul del 2026-10-20). Se arman con los datos públicos del
 * colegio para no escribir a mano nombre, dirección ni contacto.
 *
 * IMPORTANTE: "seguridad" se adaptó del ejemplo que envió Azul, pero SIN
 * la frase "almacenamos la tarjeta con cifrado AES-256": aquí la tarjeta
 * nunca toca nuestro servidor (Página de Pago alojada por Azul, ver
 * lib/payments/azul.ts). Publicar lo contrario sería falso.
 */

export interface SchoolContact {
  name: string
  address: string | null
  phone: string | null
  email: string | null
  hours: string | null
}

export interface PolicySection {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

export interface Policy {
  slug: PolicySlug
  title: string
  summary: string
  sections: PolicySection[]
  // Qué sellos se muestran en la página (Azul pide 3D Secure en "seguridad")
  logos?: 'marcas' | 'seguridad' | 'todas'
}

export const POLICY_SLUGS = ['servicios-y-pagos', 'reembolsos', 'entrega', 'privacidad', 'seguridad'] as const
export type PolicySlug = (typeof POLICY_SLUGS)[number]

// Nombre corto para los enlaces del pie de página
export const POLICY_LINK_LABELS: Record<PolicySlug, string> = {
  'servicios-y-pagos': 'Servicios y pagos',
  reembolsos: 'Reembolsos y cancelaciones',
  entrega: 'Política de entrega',
  privacidad: 'Privacidad',
  seguridad: 'Seguridad de pagos',
}

export function isPolicySlug(value: string): value is PolicySlug {
  return (POLICY_SLUGS as readonly string[]).includes(value)
}

/**
 * Azul pide la dirección "incluyendo el país". Si ya dice "República
 * Dominicana" se deja igual; si termina en "R. D." o "RD" se cambia por el
 * nombre completo; si no menciona el país, se agrega al final.
 */
export function addressWithCountry(address: string | null): string | null {
  if (!address) return null
  const clean = address.replace(/\s+/g, ' ').trim()
  if (/rep[uú]blica dominicana/i.test(clean)) return clean
  const withoutAbbrev = clean.replace(/[,\s]*\bR\.?\s?D\.?$/i, '')
  return `${withoutAbbrev}, República Dominicana`
}

// Línea "escríbenos a ... o llámanos al ..." con lo que el colegio tenga cargado
function contactLine(c: SchoolContact): string {
  const parts = [c.email && `escríbenos a ${c.email}`, c.phone && `llámanos al ${c.phone}`].filter(Boolean)
  return parts.length ? parts.join(' o ') : 'comunícate con la administración del colegio'
}

export function buildPolicy(slug: PolicySlug, c: SchoolContact): Policy {
  const contact = contactLine(c)
  const address = addressWithCountry(c.address)

  switch (slug) {
    case 'servicios-y-pagos':
      return {
        slug,
        title: 'Servicios y pagos',
        summary: `Qué se paga en el Portal Familiar de ${c.name} y cómo.`,
        logos: 'marcas',
        sections: [
          {
            heading: 'Qué ofrecemos',
            paragraphs: [
              `${c.name} es un centro educativo en República Dominicana que ofrece educación escolar presencial. Los programas de cada nivel están descritos en la página principal del colegio.`,
            ],
          },
          {
            heading: 'Qué se puede pagar en línea',
            paragraphs: ['Las familias de estudiantes inscritos pueden pagar desde el Portal Familiar:'],
            bullets: [
              'Mensualidades del año escolar, según el plan de pagos de cada estudiante.',
              'Inscripción y reinscripción, cuando corresponda.',
              'Otros cargos autorizados por la dirección del colegio (por ejemplo, actividades o materiales).',
            ],
          },
          {
            heading: 'Cada pago corresponde a una factura',
            paragraphs: [
              'Antes de pagar, el Portal Familiar muestra la factura emitida por el colegio a nombre de la familia, con su descripción, monto y fecha de vencimiento. Solo se cobra el monto de esa factura.',
            ],
          },
          {
            heading: 'Moneda',
            paragraphs: ['Todos los montos se expresan y se cobran en pesos dominicanos (RD$ / DOP).'],
          },
          {
            heading: 'Formas de pago',
            bullets: [
              'Tarjetas Visa y Mastercard, en la página de pago segura de AZUL (Banco Popular Dominicano).',
              'Transferencia bancaria, subiendo el comprobante en el Portal Familiar para que el colegio lo confirme.',
            ],
          },
        ],
      }

    case 'reembolsos':
      return {
        slug,
        title: 'Reembolsos, devoluciones y cancelaciones',
        summary: 'Tus derechos y responsabilidades antes de pagar.',
        sections: [
          {
            heading: 'Mensualidades e inscripción',
            paragraphs: [
              'Las mensualidades corresponden a servicios educativos del período facturado. Una vez prestado el servicio de ese período, el pago no es reembolsable.',
            ],
          },
          {
            heading: 'Cobros duplicados o por error',
            paragraphs: [
              'Si se cobró dos veces la misma factura, o un monto distinto al de la factura, el colegio devuelve la diferencia completa. Si la familia lo prefiere, se aplica como abono a su próxima factura.',
            ],
          },
          {
            heading: 'Retiro del estudiante',
            paragraphs: [
              'Si la familia retira al estudiante, debe notificarlo por escrito a la dirección. Los meses ya cursados no se reembolsan. Los pagos adelantados de meses no cursados se revisan y se responden por escrito.',
            ],
          },
          {
            heading: 'Pagos no aprobados o cancelados',
            paragraphs: [
              'Si el banco declina el pago, o si cancelas en la página de AZUL antes de confirmarlo, no se realiza ningún cobro y la factura sigue pendiente.',
            ],
          },
          {
            heading: 'Cómo pedir un reembolso',
            paragraphs: [
              `Para solicitar un reembolso, ${contact}, indicando el nombre del estudiante y el número de factura. Los reembolsos aprobados se devuelven por el mismo medio de pago; el tiempo en que se reflejan en tu estado de cuenta depende del banco emisor de tu tarjeta.`,
            ],
          },
        ],
      }

    case 'entrega':
      return {
        slug,
        title: 'Política de entrega',
        summary: 'Cómo y cuándo recibes lo que pagas.',
        sections: [
          {
            heading: 'Servicio presencial, sin envíos',
            paragraphs: [
              `${c.name} presta servicios educativos de forma presencial en el colegio${address ? ` (${address})` : ''}. No se venden ni se envían productos físicos a domicilio por esta vía.`,
            ],
          },
          {
            heading: 'Confirmación del pago',
            paragraphs: [
              'Cuando AZUL aprueba un pago con tarjeta, la factura aparece como pagada en el Portal Familiar de inmediato. Los pagos por transferencia se marcan como pagados cuando el colegio confirma el comprobante.',
            ],
          },
        ],
      }

    case 'privacidad':
      return {
        slug,
        title: 'Política de privacidad',
        summary: 'Qué datos usamos, para qué y cuáles son tus derechos.',
        sections: [
          {
            heading: 'Qué datos usamos',
            paragraphs: [
              'Usamos solo los datos necesarios para la vida escolar y la facturación: nombres y datos de contacto de la familia, datos académicos y de asistencia del estudiante, facturas y pagos.',
            ],
          },
          {
            heading: 'Datos de tu tarjeta',
            paragraphs: [
              'El colegio no recibe, no ve y no guarda el número de tu tarjeta, su fecha de vencimiento ni su código de seguridad (CVV). Esos datos los escribes directamente en la página de pago de AZUL.',
            ],
          },
          {
            heading: 'Con quién se comparten',
            paragraphs: [
              'No vendemos ni alquilamos tus datos. Solo los compartimos con los proveedores necesarios para prestar el servicio: AZUL (Banco Popular Dominicano) para los pagos con tarjeta, y la plataforma tecnológica que aloja el Portal Familiar.',
            ],
          },
          {
            heading: 'Tus derechos',
            paragraphs: [
              `Conforme a la Ley No. 172-13 de Protección de Datos Personales de la República Dominicana, puedes pedir acceso, corrección o eliminación de tus datos. Para hacerlo, ${contact}.`,
            ],
          },
        ],
      }

    case 'seguridad':
      return {
        slug,
        title: 'Políticas de seguridad',
        summary: 'Cómo se protegen los datos de tu tarjeta al pagar.',
        logos: 'seguridad',
        sections: [
          {
            heading: 'Sitio web',
            paragraphs: [
              'Tomamos todas las medidas y precauciones razonables para proteger tu información personal y seguimos las mejores prácticas de la industria para asegurar que tu información no sea utilizada de manera inapropiada, alterada o destruida.',
              `Toda la comunicación con nuestro sitio viaja cifrada mediante HTTPS (TLS, el sucesor de Secure Sockets Layer o SSL). ${c.name} no recibe, no ve y no almacena el número de tu tarjeta, su fecha de vencimiento ni su código de seguridad (CVV).`,
            ],
          },
          {
            heading: 'Pagos',
            paragraphs: [
              'Los pagos con tarjeta se realizan en la página de pago segura de AZUL (Banco Popular Dominicano), un servicio de terceros que cumple con los estándares de seguridad PCI-DSS y con la autenticación 3D Secure (Visa Secure y Mastercard ID Check).',
              'Al pagar, eres dirigido a la página de AZUL, donde escribes los datos de tu tarjeta. Nosotros solo recibimos el resultado del pago (aprobado o declinado) y su código de autorización. Te recomendamos leer las políticas de privacidad de AZUL para entender cómo manejan la información suministrada.',
            ],
          },
        ],
      }
  }
}
