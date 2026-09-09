/**
 * Cliente REST de Alegra (solo lectura de facturas de venta).
 *
 * Server-only, igual que el resto de núcleos de este proyecto: recibe lo
 * que necesita y no toca sesión ni cookies de Next.js. Usa `fetch` crudo,
 * no un SDK -- mismo criterio que `answerFamilyQuestion.ts`,
 * `lib/payments/azul.ts` y `lib/ocr/extractStructuredDocument.ts`, para no
 * introducir una segunda forma de hablar con un servicio externo.
 *
 * Autenticación: Basic con `ALEGRA_EMAIL:ALEGRA_TOKEN`
 * (https://developer.alegra.com). Server-only, nunca NEXT_PUBLIC_.
 *
 * La forma de la respuesta está verificada contra la cuenta real del
 * colegio el 2026-09-09 (facturas E31/E32 de septiembre), no de memoria.
 */

const ALEGRA_API = 'https://api.alegra.com/api/v1'

export interface AlegraInvoiceItem {
  name: string | null
  total: number
}

export interface AlegraInvoice {
  id: string
  date: string
  status: string
  /** e-CF, ej. "E320000000410" */
  fullNumber: string | null
  clientName: string | null
  /** Matrícula del estudiante (tipo IE) o cédula del tutor (tipo CED) */
  clientIdentification: string | null
  clientIdentificationType: string | null
  total: number
  balance: number
  paymentMethod: string | null
  note: string | null
  items: AlegraInvoiceItem[]
}

export function alegraIsConfigured(): boolean {
  return Boolean(process.env.ALEGRA_EMAIL && process.env.ALEGRA_TOKEN)
}

function authHeader(): string {
  const email = process.env.ALEGRA_EMAIL
  const token = process.env.ALEGRA_TOKEN
  if (!email || !token) throw new Error('Faltan ALEGRA_EMAIL/ALEGRA_TOKEN en el servidor.')
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
}

async function alegraGet(path: string): Promise<unknown> {
  const res = await fetch(`${ALEGRA_API}${path}`, {
    headers: { authorization: authHeader(), accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Alegra respondió ${res.status} en ${path}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizeInvoice(raw: any): AlegraInvoice {
  const items = Array.isArray(raw?.items) ? raw.items : []
  return {
    id: String(raw?.id ?? ''),
    date: String(raw?.date ?? ''),
    status: String(raw?.status ?? ''),
    fullNumber: raw?.numberTemplate?.fullNumber ?? null,
    clientName: raw?.client?.name ?? null,
    clientIdentification: raw?.client?.identification != null ? String(raw.client.identification) : null,
    clientIdentificationType: raw?.client?.identificationType ?? null,
    total: Number(raw?.total ?? 0),
    balance: Number(raw?.balance ?? 0),
    paymentMethod: raw?.paymentMethod ?? null,
    // Alegra usa `anotation` para la nota que escribe quien factura
    // ("MES DE AGOSTO", "ABONO A SEP"...); `observations` casi siempre
    // viene null pero se usa como respaldo.
    note: raw?.anotation ?? raw?.observations ?? null,
    items: items.map((it: any) => ({
      name: it?.name ?? null,
      total: Number(it?.total ?? it?.price ?? 0),
    })),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Trae las facturas de venta emitidas desde `sinceDate` (inclusive).
 *
 * Pagina de 30 en 30 (máximo que acepta Alegra) con un tope duro de
 * páginas: si algún día la cuenta tuviera miles de facturas, esta función
 * no debe convertirse en una corrida infinita dentro de un cron.
 */
export async function fetchAlegraInvoicesSince(sinceDate: string, maxPages = 20): Promise<AlegraInvoice[]> {
  const out: AlegraInvoice[] = []
  for (let page = 0; page < maxPages; page++) {
    const start = page * 30
    const query = `?date_afterOrNow=${encodeURIComponent(sinceDate)}&limit=30&start=${start}` +
      `&order_field=date&order_direction=ASC`
    const batch = await alegraGet(`/invoices${query}`)
    const rows = Array.isArray(batch) ? batch : []
    if (rows.length === 0) break
    out.push(...rows.map(normalizeInvoice))
    if (rows.length < 30) break
  }
  return out
}

/**
 * Detalle de una factura -- necesario porque el listado no siempre trae
 * `items` ni `anotation`, y sin los items no se puede separar la parte de
 * mensualidad de los cobros de Libros/Uniformes.
 */
export async function fetchAlegraInvoiceDetail(id: string): Promise<AlegraInvoice> {
  return normalizeInvoice(await alegraGet(`/invoices/${encodeURIComponent(id)}`))
}
