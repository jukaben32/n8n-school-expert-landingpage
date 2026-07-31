/**
 * Sync de facturas de proveedores aprobadas hacia Alegra (POST /bills).
 *
 * PENDIENTE de definir con el usuario (no bloquea el resto del flujo, tal
 * como pide el mandato): el mapeo RNC -> contacto de Alegra y categoría ->
 * cuenta contable. Sin esos dos mapeos, Alegra rechazaría la mayoría de las
 * facturas reales (un "bill" en Alegra necesita un contactId numérico y un
 * categoryId/accountId numérico, no el RNC ni el texto libre que extrae
 * Claude). Esta función deja el resto del flujo (bandeja de revisión,
 * aprobación) funcionando ya mismo -- el sync es lo único que queda a medio
 * construir, con un mensaje explícito en vez de fallar en silencio.
 *
 * Variables de entorno esperadas (API key auth de Alegra -- ver
 * https://developer.alegra.com):
 *   ALEGRA_EMAIL — correo de la cuenta de Alegra del colegio.
 *   ALEGRA_TOKEN — API token de esa cuenta.
 * Igual que ANTHROPIC_API_KEY/SUPABASE_SERVICE_ROLE_KEY: server-only, nunca
 * en el cliente.
 */

export interface AlegraSyncInput {
  proveedor: string
  rnc: string | null
  ncf: string | null
  fecha: string | null
  subtotal: number
  itbis: number
  total: number
  categoria: string | null
}

export type AlegraSyncResult =
  | { ok: true; billId: string }
  | { ok: false; error: string }

export async function syncInvoiceToAlegra(input: AlegraSyncInput): Promise<AlegraSyncResult> {
  const email = process.env.ALEGRA_EMAIL
  const token = process.env.ALEGRA_TOKEN
  if (!email || !token) {
    return { ok: false, error: 'Alegra no está configurado en este colegio todavía (faltan ALEGRA_EMAIL/ALEGRA_TOKEN). La factura queda aprobada pero sin sincronizar.' }
  }

  // PENDIENTE: resolver contactId a partir de input.rnc (buscar/crear
  // contacto en Alegra) y categoryId/accountId a partir de
  // input.categoria -- ambos mapeos quedaron sin definir con el usuario.
  // Sin ellos no se puede armar un payload de /bills válido todavía.
  return {
    ok: false,
    error: `Falta definir el mapeo RNC→contacto y categoría→cuenta contable de Alegra antes de poder sincronizar automáticamente (factura de "${input.proveedor}").`,
  }

  // Forma esperada de la llamada una vez resueltos esos mapeos:
  //
  // const auth = Buffer.from(`${email}:${token}`).toString('base64')
  // const res = await fetch('https://api.alegra.com/api/v1/bills', {
  //   method: 'POST',
  //   headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
  //   body: JSON.stringify({
  //     date: input.fecha,
  //     provider: { id: resolvedContactId },
  //     items: [{ price: input.subtotal, tax: [{ id: resolvedTaxId }], description: input.proveedor }],
  //   }),
  // })
  // if (!res.ok) return { ok: false, error: `Alegra respondió ${res.status}: ${await res.text()}` }
  // const bill = await res.json()
  // return { ok: true, billId: String(bill.id) }
}
