import { PDFDocument } from 'pdf-lib'

/**
 * extractStructuredDocument — núcleo OCR reutilizable de SchoolOS.
 *
 * Mismo principio que answerFamilyQuestion.ts (AGENTS.md, "un solo cerebro"):
 * una única función server-only, sin sesión ni Next.js, que ambos casos de
 * uso (facturas de proveedores y fichas de inscripción) llaman con un JSON
 * schema de campos distinto -- la llamada a Claude vive en un solo lugar.
 *
 * Usa fetch crudo a la API de Anthropic (no el SDK oficial) para seguir el
 * mismo patrón que answerFamilyQuestion.ts y lib/payments/azul.ts, ya
 * establecido en este proyecto -- no se agrega una segunda forma de hablar
 * con la API de Anthropic.
 *
 * Modelo: claude-sonnet-5. Se prefirió sobre Haiku (usado en el asistente de
 * IA) porque aquí la precisión importa más que el costo -- estos datos
 * alimentan matrícula real y facturas reales, no una conversación de chat.
 * `thinking` va deshabilitado: es una extracción de un solo turno sobre un
 * documento ya dado, no una tarea que se beneficie de razonamiento extendido.
 *
 * Regla de seguridad no negociable: esta función NUNCA crea ni aprueba nada
 * en la base de datos -- solo devuelve JSON estructurado. El registro final
 * (factura aprobada, estudiante/familia) siempre pasa por una bandeja de
 * revisión humana en el código que llama a esta función.
 */

const MODEL = 'claude-sonnet-5'
const MAX_OUTPUT_TOKENS = 2048
const MAX_DOCUMENTS_PER_BATCH = 40
const CONCURRENCY = 3

export type SourceMediaType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'

export interface SourceDocument {
  mediaType: SourceMediaType
  /** Contenido en base64, sin el prefijo "data:...;base64,". */
  base64: string
}

export type ExtractStructuredDocumentInput =
  /** Varios archivos sueltos subidos a la vez -- cada uno es un documento independiente. */
  | { kind: 'files'; documents: SourceDocument[] }
  /** Un PDF multi-página donde cada página es un documento independiente (ej. 20 fichas escaneadas de corrido). */
  | { kind: 'multiPagePdf'; base64: string }

export interface ExtractedDocumentResult {
  /** Posición en el lote (0-indexado) -- para "multiPagePdf", corresponde al número de página - 1. */
  index: number
  ok: boolean
  data: Record<string, unknown> | null
  error: string | null
}

export interface ExtractStructuredDocumentParams {
  input: ExtractStructuredDocumentInput
  /**
   * JSON schema (sin "$schema") de UN documento. Debe tener
   * additionalProperties:false en cada objeto (requisito de structured
   * outputs) y debería incluir una propiedad de confianza -- ver los
   * schemas de cada caso de uso en este mismo directorio para el patrón.
   */
  schema: Record<string, unknown>
  /** Instrucciones de dominio: qué es cada campo, cómo tratar campos ilegibles o ausentes. */
  instructions: string
}

export type ExtractStructuredDocumentResult =
  | { ok: true; results: ExtractedDocumentResult[] }
  | { ok: false; error: string }

export async function extractStructuredDocument(
  params: ExtractStructuredDocumentParams
): Promise<ExtractStructuredDocumentResult> {
  const envApiKey = process.env.ANTHROPIC_API_KEY
  if (!envApiKey) {
    return { ok: false, error: 'El escaneo no está configurado (falta ANTHROPIC_API_KEY).' }
  }
  const apiKey: string = envApiKey

  let documents: SourceDocument[]
  try {
    documents = await resolveDocuments(params.input)
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'error desconocido'
    return { ok: false, error: `No se pudo preparar el documento: ${detail}` }
  }

  if (documents.length === 0) {
    return { ok: false, error: 'No se recibió ningún documento para procesar.' }
  }
  if (documents.length > MAX_DOCUMENTS_PER_BATCH) {
    return { ok: false, error: `Demasiados documentos en un solo lote (máximo ${MAX_DOCUMENTS_PER_BATCH}).` }
  }

  const results: ExtractedDocumentResult[] = new Array(documents.length)
  let cursor = 0
  async function worker() {
    for (;;) {
      const i = cursor++
      if (i >= documents.length) return
      results[i] = await extractOne(apiKey, documents[i], params.schema, params.instructions, i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, documents.length) }, worker))

  return { ok: true, results }
}

/**
 * Divide un PDF multi-página en N PDFs de una sola página con pdf-lib
 * (JS puro, sin dependencias nativas -- seguro en el entorno serverless de
 * Vercel). Cada página se procesa como un documento independiente, con su
 * propio resultado/confianza/error -- una página con letra ilegible no
 * contamina el resultado de las demás.
 */
async function resolveDocuments(input: ExtractStructuredDocumentInput): Promise<SourceDocument[]> {
  if (input.kind === 'files') return input.documents

  const sourceBytes = Buffer.from(input.base64, 'base64')
  const source = await PDFDocument.load(sourceBytes)
  const pageCount = source.getPageCount()

  const pages: SourceDocument[] = []
  for (let i = 0; i < pageCount; i++) {
    const single = await PDFDocument.create()
    const [copiedPage] = await single.copyPages(source, [i])
    single.addPage(copiedPage)
    const pageBytes = await single.save()
    pages.push({ mediaType: 'application/pdf', base64: Buffer.from(pageBytes).toString('base64') })
  }
  return pages
}

async function extractOne(
  apiKey: string,
  doc: SourceDocument,
  schema: Record<string, unknown>,
  instructions: string,
  index: number
): Promise<ExtractedDocumentResult> {
  const documentBlock =
    doc.mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: doc.base64 } }
      : { type: 'image', source: { type: 'base64', media_type: doc.mediaType, data: doc.base64 } }

  const body = {
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    thinking: { type: 'disabled' },
    system: `Extraes datos estructurados de documentos escaneados dominicanos. ${instructions}\n\nSi un campo no es legible o no aparece en el documento, usa null -- nunca inventes ni adivines un valor. Responde únicamente con el JSON del schema, sin texto adicional.`,
    output_config: { format: { type: 'json_schema', schema } },
    messages: [
      {
        role: 'user',
        content: [documentBlock, { type: 'text', text: 'Extrae los campos de este documento según el schema indicado.' }],
      },
    ],
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return { index, ok: false, data: null, error: `Anthropic API respondió ${res.status}: ${errText.slice(0, 300)}` }
    }

    const responseData = (await res.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string }

    if (responseData.stop_reason === 'refusal') {
      return { index, ok: false, data: null, error: 'El modelo rechazó procesar este documento.' }
    }

    const text = responseData.content?.find((block) => block.type === 'text')?.text
    if (!text) {
      return { index, ok: false, data: null, error: 'La respuesta del modelo no tuvo contenido de texto.' }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return { index, ok: false, data: null, error: 'La respuesta del modelo no fue JSON válido.' }
    }

    return { index, ok: true, data: parsed as Record<string, unknown>, error: null }
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'error desconocido'
    return { index, ok: false, data: null, error: `No se pudo llamar a Claude: ${detail}` }
  }
}
