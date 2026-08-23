'use server'

import crypto from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import { extractStructuredDocument, type SourceMediaType } from '@/lib/ocr/extractStructuredDocument'
import { vendorInvoiceSchema, vendorInvoiceInstructions, type VendorInvoiceData } from '@/lib/ocr/vendorInvoiceSchema'
import { syncInvoiceToAlegra } from '@/lib/accounting/alegra'

const BUCKET = 'facturas-proveedores'
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_PDF_BYTES = 25 * 1024 * 1024

const MEDIA_TYPE_BY_MIME: Record<string, SourceMediaType> = {
  'application/pdf': 'application/pdf',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
}

interface ActionResult {
  ok: boolean
  error?: string
}

async function resolveInvoiceStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'No hay sesión activa.' }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('id, role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !canAccess(profile.role, 'tesoreria_proveedores')) {
    return { ok: false as const, error: 'No tienes permiso para revisar facturas de proveedores.' }
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  return { ok: true as const, staffProfileId: profile.id as string, schoolId }
}

export interface PendingVendorInvoice {
  id: string
  storage_path: string
  source_page: number | null
  confidence: number | null
  extraction_error: string | null
  extracted_data: VendorInvoiceData | null
  created_at: string
}

export async function listPendingVendorInvoices(): Promise<PendingVendorInvoice[]> {
  const staff = await resolveInvoiceStaff()
  if (!staff.ok) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('vendor_invoices')
    .select('id, storage_path, source_page, confidence, extraction_error, extracted_data, created_at')
    .eq('school_id', staff.schoolId)
    .eq('status', 'pendiente')
    .order('created_at', { ascending: true })

  return (data ?? []) as unknown as PendingVendorInvoice[]
}

export async function getVendorInvoiceSignedUrl(invoiceId: string): Promise<string | null> {
  const staff = await resolveInvoiceStaff()
  if (!staff.ok) return null

  const admin = createAdminClient()
  const { data: invoice } = await admin
    .from('vendor_invoices')
    .select('storage_path')
    .eq('id', invoiceId)
    .eq('school_id', staff.schoolId)
    .single()
  if (!invoice) return null

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(invoice.storage_path, 300)
  if (error || !data) return null
  return data.signedUrl
}

export type UploadVendorInvoicesResult = { ok: true; created: number } | { ok: false; error: string }

export async function uploadVendorInvoices(formData: FormData): Promise<UploadVendorInvoicesResult> {
  const staff = await resolveInvoiceStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const mode = formData.get('mode')
  const files = formData.getAll('file').filter((f): f is File => f instanceof File)
  if (files.length === 0) return { ok: false, error: 'No se recibió ningún archivo.' }

  const admin = createAdminClient()

  if (mode === 'multiPagePdf') {
    const file = files[0]
    if (MEDIA_TYPE_BY_MIME[file.type] !== 'application/pdf') {
      return { ok: false, error: 'Para el modo "PDF multi-página" el archivo debe ser un PDF.' }
    }
    if (file.size > MAX_PDF_BYTES) return { ok: false, error: 'El PDF es demasiado grande (máximo 25MB).' }

    const bytes = Buffer.from(await file.arrayBuffer())
    const storagePath = `${staff.schoolId}/${crypto.randomUUID()}.pdf`
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, { contentType: 'application/pdf' })
    if (uploadError) return { ok: false, error: `No se pudo subir el archivo: ${uploadError.message}` }

    const extraction = await extractStructuredDocument({
      input: { kind: 'multiPagePdf', base64: bytes.toString('base64') },
      schema: vendorInvoiceSchema,
      instructions: vendorInvoiceInstructions,
    })
    if (!extraction.ok) return { ok: false, error: extraction.error }

    const rows = extraction.results.map((r) => ({
      school_id: staff.schoolId,
      uploaded_by: staff.staffProfileId,
      storage_path: storagePath,
      source_page: r.index + 1,
      status: 'pendiente',
      extracted_data: r.data,
      confidence: r.ok ? confidenceOf(r.data) : null,
      extraction_error: r.error,
    }))
    const { error: insertError } = await admin.from('vendor_invoices').insert(rows)
    if (insertError) return { ok: false, error: insertError.message }

    revalidatePath('/dashboard/tesoreria/facturas-proveedores')
    return { ok: true, created: rows.length }
  }

  const prepared: { file: File; mediaType: SourceMediaType; base64: string }[] = []
  for (const file of files) {
    const mediaType = MEDIA_TYPE_BY_MIME[file.type]
    if (!mediaType) return { ok: false, error: `Tipo de archivo no soportado: "${file.name}".` }
    if (file.size > MAX_FILE_BYTES) return { ok: false, error: `El archivo "${file.name}" es demasiado grande (máximo 10MB).` }
    const bytes = Buffer.from(await file.arrayBuffer())
    prepared.push({ file, mediaType, base64: bytes.toString('base64') })
  }

  const extraction = await extractStructuredDocument({
    input: { kind: 'files', documents: prepared.map((p) => ({ mediaType: p.mediaType, base64: p.base64 })) },
    schema: vendorInvoiceSchema,
    instructions: vendorInvoiceInstructions,
  })
  if (!extraction.ok) return { ok: false, error: extraction.error }

  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < prepared.length; i++) {
    const p = prepared[i]
    const extension = p.mediaType === 'application/pdf' ? 'pdf' : p.mediaType.split('/')[1]
    const storagePath = `${staff.schoolId}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, Buffer.from(p.base64, 'base64'), { contentType: p.mediaType })
    if (uploadError) return { ok: false, error: `No se pudo subir "${p.file.name}": ${uploadError.message}` }

    const r = extraction.results[i]
    rows.push({
      school_id: staff.schoolId,
      uploaded_by: staff.staffProfileId,
      storage_path: storagePath,
      source_page: null,
      status: 'pendiente',
      extracted_data: r.data,
      confidence: r.ok ? confidenceOf(r.data) : null,
      extraction_error: r.error,
    })
  }

  const { error: insertError } = await admin.from('vendor_invoices').insert(rows)
  if (insertError) return { ok: false, error: insertError.message }

  revalidatePath('/dashboard/tesoreria/facturas-proveedores')
  return { ok: true, created: rows.length }
}

function confidenceOf(data: Record<string, unknown> | null): number | null {
  const value = data?.confianza
  return typeof value === 'number' ? value : null
}

export interface ApproveVendorInvoiceInput {
  proveedor: string
  rnc: string | null
  ncf: string | null
  fecha: string | null
  subtotal: number
  itbis: number
  total: number
  categoria: string | null
}

/**
 * Aprueba una factura con los valores que el staff corrigió en pantalla
 * (nunca con extracted_data directamente) e intenta sincronizarla con
 * Alegra. Si Alegra no está configurado o falla, la factura queda
 * 'aprobado' de todas formas -- el sync es una preocupación aparte, no
 * bloquea la aprobación (ver web/src/lib/accounting/alegra.ts).
 */
export async function approveVendorInvoice(invoiceId: string, input: ApproveVendorInvoiceInput): Promise<ActionResult> {
  const staff = await resolveInvoiceStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const admin = createAdminClient()
  const { data: invoice } = await admin
    .from('vendor_invoices')
    .select('id, status')
    .eq('id', invoiceId)
    .eq('school_id', staff.schoolId)
    .single()
  if (!invoice) return { ok: false, error: 'No se encontró la factura.' }
  if (invoice.status !== 'pendiente') return { ok: false, error: 'Esta factura ya fue revisada.' }

  const syncResult = await syncInvoiceToAlegra({
    proveedor: input.proveedor,
    rnc: input.rnc,
    ncf: input.ncf,
    fecha: input.fecha,
    subtotal: input.subtotal,
    itbis: input.itbis,
    total: input.total,
    categoria: input.categoria,
  })

  await admin
    .from('vendor_invoices')
    .update({
      status: 'aprobado',
      reviewed_by: staff.staffProfileId,
      reviewed_at: new Date().toISOString(),
      alegra_sync_status: syncResult.ok ? 'sincronizado' : 'error',
      alegra_bill_id: syncResult.ok ? syncResult.billId : null,
      alegra_sync_error: syncResult.ok ? null : syncResult.error,
    })
    .eq('id', invoiceId)

  revalidatePath('/dashboard/tesoreria/facturas-proveedores')
  return { ok: true }
}

export async function rejectVendorInvoice(invoiceId: string, reason: string): Promise<ActionResult> {
  const staff = await resolveInvoiceStaff()
  if (!staff.ok) return { ok: false, error: staff.error }

  const admin = createAdminClient()
  const { data: invoice } = await admin
    .from('vendor_invoices')
    .select('id, status')
    .eq('id', invoiceId)
    .eq('school_id', staff.schoolId)
    .single()
  if (!invoice) return { ok: false, error: 'No se encontró la factura.' }
  if (invoice.status !== 'pendiente') return { ok: false, error: 'Esta factura ya fue revisada.' }

  await admin
    .from('vendor_invoices')
    .update({
      status: 'rechazado',
      reviewed_by: staff.staffProfileId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason.trim() || null,
    })
    .eq('id', invoiceId)

  revalidatePath('/dashboard/tesoreria/facturas-proveedores')
  return { ok: true }
}
