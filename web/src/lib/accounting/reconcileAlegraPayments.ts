import { createAdminClient } from '@/lib/supabase/admin'
import { alegraIsConfigured, fetchAlegraInvoicesSince, fetchAlegraInvoiceDetail } from './alegraClient'
import { matchInvoice, mensualidadAmount, type MatchReason, type StudentRow, type GuardianRow } from './alegraMatching'

/**
 * Conciliación automática Alegra → Cuentas por Cobrar.
 *
 * Qué resuelve: el colegio cobra en Alegra POS y hasta el 2026-09-09 esos
 * cobros había que cargarlos aquí a mano (o con un script de una sola vez),
 * así que Cuentas por Cobrar mostraba como deuda dinero ya pagado.
 *
 * ── LA REGLA QUE NO SE NEGOCIA ──────────────────────────────────────────
 * Este motor SOLO carga solo un cobro cuando el emparejamiento es
 * inequívoco. Todo lo demás va a la bandeja `alegra_payment_matches` para
 * que una persona lo resuelva. No es prudencia decorativa: en la
 * conciliación real del 2026-09-09, de 34 cobros, 26 emparejaron exactos y
 * 8 necesitaron criterio humano (4 diferencias de escritura del nombre, 2
 * hermanos bajo un mismo e-CF, 1 nombre distinto, 1 estudiante que ni
 * existía en la plataforma). Adivinar esos 8 es meterle plata al
 * estudiante equivocado.
 *
 * ── NUNCA GENERA NCF ────────────────────────────────────────────────────
 * `ncf`/`ncf_type` quedan en null siempre, igual que `recordExternalPayment`.
 * El comprobante fiscal real ya lo emitió Alegra (e-CF); emitir uno aquí
 * sería un documento fantasma ante la DGII.
 *
 * ── NUNCA APLICA MORA ───────────────────────────────────────────────────
 * Cierra cada cuota por lo que de verdad se cobró. Si el colegio no cobró
 * el recargo, aquí tampoco se cobra (decisión explícita del usuario,
 * 2026-09-09). El recargo de Cuentas por Cobrar es calculado, no una
 * factura: al quedar la cuota saldada, desaparece solo.
 */

export interface ReconcileResult {
  runId: string | null
  status: 'ok' | 'error' | 'sin_credenciales'
  invoicesSeen: number
  loadedCount: number
  loadedAmount: number
  reviewCount: number
  skippedCount: number
  errorMessage?: string
}

/**
 * Corre la conciliación para un colegio.
 *
 * `sinceDays` mira 30 días hacia atrás a propósito, no solo desde la
 * última corrida: en Alegra se registran facturas con fecha anterior al
 * día en que se teclean, y volver a ver un cobro ya cargado es inofensivo
 * (el guardaduplicados por e-CF lo salta).
 */
export async function reconcileAlegraPayments(options: {
  schoolId: string
  trigger?: 'cron' | 'manual'
  sinceDays?: number
}): Promise<ReconcileResult> {
  const { schoolId, trigger = 'cron', sinceDays = 30 } = options
  const admin = createAdminClient()

  const since = new Date()
  since.setDate(since.getDate() - sinceDays)
  const sinceDate = since.toISOString().slice(0, 10)

  const { data: run } = await admin
    .from('alegra_sync_runs')
    .insert({ school_id: schoolId, trigger_source: trigger, since_date: sinceDate, status: 'ok' })
    .select('id')
    .single()
  const runId = run?.id ?? null

  const finish = async (result: Omit<ReconcileResult, 'runId'>): Promise<ReconcileResult> => {
    if (runId) {
      await admin.from('alegra_sync_runs').update({
        finished_at: new Date().toISOString(),
        status: result.status,
        invoices_seen: result.invoicesSeen,
        loaded_count: result.loadedCount,
        loaded_amount: result.loadedAmount,
        review_count: result.reviewCount,
        skipped_count: result.skippedCount,
        error_message: result.errorMessage ?? null,
      }).eq('id', runId)
    }
    return { runId, ...result }
  }

  if (!alegraIsConfigured()) {
    return finish({
      status: 'sin_credenciales',
      invoicesSeen: 0, loadedCount: 0, loadedAmount: 0, reviewCount: 0, skippedCount: 0,
      errorMessage: 'Faltan ALEGRA_EMAIL/ALEGRA_TOKEN en el servidor. No se pudo consultar Alegra.',
    })
  }

  let invoicesSeen = 0
  let loadedCount = 0
  let loadedAmount = 0
  let reviewCount = 0
  let skippedCount = 0

  try {
    const listado = await fetchAlegraInvoicesSince(sinceDate)
    invoicesSeen = listado.length

    const [{ data: students }, { data: guardians }, { data: yaCargadas }, { data: enBandeja }] = await Promise.all([
      admin.from('students')
        .select('id, first_name, last_name, student_code, family_id, grade_level')
        .eq('school_id', schoolId).eq('enrollment_status', 'inscrito').is('deleted_at', null),
      admin.from('guardians').select('family_id, first_name, last_name, national_id'),
      admin.from('invoices')
        .select('external_reference')
        .eq('school_id', schoolId).not('external_reference', 'is', null).is('deleted_at', null),
      admin.from('alegra_payment_matches').select('alegra_invoice_id').eq('school_id', schoolId),
    ])

    const alumnos = (students ?? []) as StudentRow[]
    const tutores = (guardians ?? []) as GuardianRow[]
    const referenciasCargadas = new Set((yaCargadas ?? []).map((r) => r.external_reference as string))
    const yaEnBandeja = new Set((enBandeja ?? []).map((r) => r.alegra_invoice_id as string))

    // Concepto "Mensualidad" (find-or-create, igual que recordExternalPayment)
    let { data: concept } = await admin
      .from('billing_concepts')
      .select('id')
      .eq('school_id', schoolId).eq('recurrence', 'monthly')
      .ilike('name', '%mensualidad%').is('deleted_at', null)
      .limit(1).maybeSingle()

    for (const resumen of listado) {
      // Anuladas y borradores no son cobros reales.
      if (resumen.status === 'void' || resumen.status === 'draft') { skippedCount++; continue }
      if (yaEnBandeja.has(resumen.id)) { skippedCount++; continue }
      if (resumen.fullNumber && referenciasCargadas.has(resumen.fullNumber)) { skippedCount++; continue }

      // El listado no siempre trae items ni la nota: hace falta el detalle
      // para separar mensualidad de Libros/Uniformes.
      const invoice = resumen.items.length > 0 ? resumen : await fetchAlegraInvoiceDetail(resumen.id)
      const monto = mensualidadAmount(invoice)
      if (monto <= 0) { skippedCount++; continue }  // Libros, Uniformes, solo mora, etc.

      const { candidates, auto, reason } = matchInvoice(invoice, alumnos, tutores)

      let motivo: MatchReason | null = reason
      let cargar = auto

      // Guarda para los cobros cargados a mano ANTES de que existiera
      // `external_reference` (los 72 de septiembre 2026): si ese estudiante
      // ya tiene una factura pagada del mismo monto y la misma fecha sin
      // referencia, puede ser el mismo cobro. No se salta en silencio --
      // eso fue justo el punto ciego que casi pierde RD$1,950 de Heather
      // Liz -- se manda a revisión para que una persona decida.
      if (cargar) {
        const { data: parecidas } = await admin
          .from('invoices')
          .select('id')
          .eq('school_id', schoolId).eq('student_id', cargar.studentId)
          .eq('status', 'pagado').eq('total_amount', monto)
          .is('external_reference', null).is('deleted_at', null)
          .eq('due_date', invoice.date)
        if ((parecidas ?? []).length > 0) {
          motivo = 'posible_duplicado'
          cargar = null
        }
      }

      if (cargar) {
        if (!concept) {
          const { data: nuevo } = await admin.from('billing_concepts')
            .insert({ school_id: schoolId, name: 'Mensualidad', amount: monto, recurrence: 'monthly', applies_to: 'student' })
            .select('id').single()
          concept = nuevo
        }
        const alumno = alumnos.find((s) => s.id === cargar!.studentId)
        if (!alumno) { skippedCount++; continue }

        const etiqueta = [invoice.fullNumber ? `e-CF ${invoice.fullNumber}` : null, invoice.paymentMethod, invoice.note]
          .filter(Boolean).join(' · ')
        const { data: facturaCreada, error: errorFactura } = await admin.from('invoices').insert({
          school_id: schoolId,
          family_id: alumno.family_id,
          student_id: alumno.id,
          concept_id: concept?.id ?? null,
          description: `Mensualidad — cobro ya registrado (Alegra (POS)): ${etiqueta}`,
          amount: monto, tax_amount: 0, total_amount: monto,
          due_date: invoice.date, status: 'pagado',
          paid_at: new Date(`${invoice.date}T00:00:00`).toISOString(),
          ncf: null, ncf_type: null,
          external_reference: invoice.fullNumber,
        }).select('id').single()

        if (errorFactura || !facturaCreada) {
          // El índice único de `external_reference` es la última línea de
          // defensa contra un doble cobro: si salta, es que ya estaba
          // cargado. No es un fallo de la corrida.
          skippedCount++
          continue
        }

        await admin.from('payments').insert({
          school_id: schoolId,
          invoice_id: facturaCreada.id,
          amount_paid: monto,
          payment_method: 'alegra',
          paid_at: new Date(`${invoice.date}T00:00:00`).toISOString(),
          notes: etiqueta || null,
        })
        loadedCount++
        loadedAmount += monto
        if (invoice.fullNumber) referenciasCargadas.add(invoice.fullNumber)
        continue
      }

      await admin.from('alegra_payment_matches').insert({
        school_id: schoolId,
        run_id: runId,
        alegra_invoice_id: invoice.id,
        alegra_number: invoice.fullNumber,
        alegra_date: invoice.date,
        alegra_client_name: invoice.clientName,
        alegra_client_identification: invoice.clientIdentification,
        alegra_client_id_type: invoice.clientIdentificationType,
        alegra_note: invoice.note,
        alegra_payment_method: invoice.paymentMethod,
        amount: monto,
        reason: motivo ?? 'sin_emparejar',
        candidates,
      })
      yaEnBandeja.add(invoice.id)
      reviewCount++
    }

    return finish({
      status: 'ok', invoicesSeen, loadedCount,
      loadedAmount: Math.round(loadedAmount * 100) / 100,
      reviewCount, skippedCount,
    })
  } catch (error) {
    // Los errores de Postgrest/fetch no siempre son instancias de Error
    // (trampa ya documentada en AGENTS.md) -- se serializa lo que venga.
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    return finish({
      status: 'error', invoicesSeen, loadedCount,
      loadedAmount: Math.round(loadedAmount * 100) / 100,
      reviewCount, skippedCount, errorMessage: message.slice(0, 1000),
    })
  }
}
