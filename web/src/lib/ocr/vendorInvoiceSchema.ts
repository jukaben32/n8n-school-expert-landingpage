/**
 * Schema y campos extraídos de una factura de proveedor escaneada.
 * Ver AGENTS.md, sección "Facturas de proveedores → Alegra (OCR)".
 */

const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] }
const nullableNumber = { anyOf: [{ type: 'number' }, { type: 'null' }] }

export const vendorInvoiceSchema = {
  type: 'object',
  properties: {
    confianza: {
      type: 'number',
      description: '0 a 1 -- qué tan seguro estás de haber leído correctamente la factura completa.',
    },
    proveedor: { ...nullableString, description: 'Nombre o razón social del proveedor que emitió la factura.' },
    rnc: { ...nullableString, description: 'RNC (Registro Nacional del Contribuyente) del proveedor.' },
    ncf: { ...nullableString, description: 'Número de Comprobante Fiscal (NCF), formato tipo B01/B15/E31 seguido de dígitos.' },
    fecha: { ...nullableString, description: 'Fecha de la factura en formato YYYY-MM-DD si se puede inferir con certeza; si no, null.' },
    subtotal: { ...nullableNumber, description: 'Monto antes de ITBIS, en pesos dominicanos (DOP).' },
    itbis: { ...nullableNumber, description: 'Monto de ITBIS (impuesto), en DOP.' },
    total: { ...nullableNumber, description: 'Monto total de la factura, en DOP.' },
    categoria_sugerida: {
      ...nullableString,
      description:
        'Categoría de gasto sugerida a partir del contenido de la factura (ej. "Útiles y papelería", "Mantenimiento", "Alimentación", "Servicios básicos", "Transporte", "Tecnología", "Otro"). Es solo una sugerencia -- el staff de tesorería la confirma o corrige.',
    },
  },
  required: ['confianza', 'proveedor', 'rnc', 'ncf', 'fecha', 'subtotal', 'itbis', 'total', 'categoria_sugerida'],
  additionalProperties: false,
} as const

export const vendorInvoiceInstructions = `Cada documento es UNA factura de un proveedor del colegio (República Dominicana). Extrae: nombre del proveedor, RNC, NCF, fecha de emisión, subtotal, ITBIS y total (en pesos dominicanos), y sugiere una categoría de gasto breve según lo que se está comprando. No inventes un RNC o NCF que no puedas leer con razonable certeza -- usa null en ese caso.`

export interface VendorInvoiceData {
  confianza: number
  proveedor: string | null
  rnc: string | null
  ncf: string | null
  fecha: string | null
  subtotal: number | null
  itbis: number | null
  total: number | null
  categoria_sugerida: string | null
}
