import { createAdminClient } from '@/lib/supabase/admin'
import { alegraIsConfigured, fetchAlegraInvoicesSince, fetchAlegraInvoiceDetail, type AlegraInvoice } from './alegraClient'
import { matchInvoice, mensualidadAmount, splitByTuition, type Candidate, type MatchReason, type StudentRow, type GuardianRow } from './alegraMatching'
import { syncStudentCodesFromAlegra, learnStudentCode } from './syncStudentCodes'

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
    // Antes de emparejar: vincular matrículas de Alegra con los estudiantes
    // que aún no la tienen, para que el emparejamiento sea por matrícula y
    // no por cómo se escribió el nombre. Si esto falla, la corrida sigue
    // igual (por nombre), no se cae.
    try {
      await syncStudentCodesFromAlegra(schoolId)
    } catch (syncError) {
      console.error('[alegra] No se pudieron vincular matrículas:', syncError)
    }

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
      admin.from('alegra_payment_matches')
        .select('id, alegra_invoice_id, alegra_number, alegra_date, alegra_client_name, alegra_client_identification, alegra_client_id_type, alegra_note, alegra_payment_method, amount, assigned_amount, status')
        .eq('school_id', schoolId),
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

    const conceptId = async (monto: number): Promise<string | null> => {
      if (!concept) {
        const { data: nuevo } = await admin.from('billing_concepts')
          .insert({ school_id: schoolId, name: 'Mensualidad', amount: monto, recurrence: 'monthly', applies_to: 'student' })
          .select('id').single()
        concept = nuevo
      }
      return concept?.id ?? null
    }

    // Cuota mensual neta (nivel/beca/descuento por hermanos) de un estudiante,
    // de la MISMA función que usa Cuentas por Cobrar. Solo se pide para los
    // hermanos de un comprobante conjunto.
    const cuotaCache = new Map<string, number | null>()
    const cuotaMensual = async (studentId: string): Promise<number | null> => {
      if (cuotaCache.has(studentId)) return cuotaCache.get(studentId)!
      const { data } = await admin.rpc('student_tuition_basis', { p_student_id: studentId })
      const fila = Array.isArray(data) ? data[0] : data
      const valor = fila && fila.configured !== false && Number(fila.monthly_amount) > 0 ? Number(fila.monthly_amount) : null
      cuotaCache.set(studentId, valor)
      return valor
    }

    // Guarda para los cobros cargados a mano ANTES de que existiera
    // `external_reference` (los 72 de septiembre 2026): si ese estudiante
    // ya tiene una factura pagada del mismo monto y la misma fecha sin
    // referencia, puede ser el mismo cobro. No se salta en silencio --
    // eso fue justo el punto ciego que casi pierde RD$1,950 de Heather
    // Liz -- se manda a revisión para que una persona decida.
    const pareceDuplicado = async (studentId: string, monto: number, fecha: string): Promise<boolean> => {
      const { data: parecidas } = await admin
        .from('invoices')
        .select('id')
        .eq('school_id', schoolId).eq('student_id', studentId)
        .eq('status', 'pagado').eq('total_amount', monto)
        .is('external_reference', null).is('deleted_at', null)
        .eq('due_date', fecha)
      return (parecidas ?? []).length > 0
    }

    const registrar = async (alumno: StudentRow, monto: number, invoice: AlegraInvoice, extra?: string): Promise<boolean> => {
      const etiqueta = [invoice.fullNumber ? `e-CF ${invoice.fullNumber}` : null, invoice.paymentMethod, invoice.note, extra]
        .filter(Boolean).join(' · ')
      const { data: facturaCreada, error: errorFactura } = await admin.from('invoices').insert({
        school_id: schoolId,
        family_id: alumno.family_id,
        student_id: alumno.id,
        concept_id: await conceptId(monto),
        description: `Mensualidad — cobro ya registrado (Alegra (POS)): ${etiqueta}`,
        amount: monto, tax_amount: 0, total_amount: monto,
        due_date: invoice.date, status: 'pagado',
        paid_at: new Date(`${invoice.date}T00:00:00`).toISOString(),
        ncf: null, ncf_type: null,
        external_reference: invoice.fullNumber,
      }).select('id').single()
      // El índice único (school_id, external_reference, student_id) es la
      // última línea de defensa contra un doble cobro: si salta, ya estaba.
      if (errorFactura || !facturaCreada) return false
      await admin.from('payments').insert({
        school_id: schoolId,
        invoice_id: facturaCreada.id,
        amount_paid: monto,
        payment_method: 'alegra',
        paid_at: new Date(`${invoice.date}T00:00:00`).toISOString(),
        notes: etiqueta || null,
      })
      return true
    }

    type Resultado =
      | { tipo: 'cargado'; monto: number }
      | { tipo: 'revision'; motivo: MatchReason; candidates: Candidate[]; asignado: number }
      | { tipo: 'saltado' }

    /**
     * Un solo camino para decidir y registrar un cobro: lo usan los cobros
     * nuevos y el reintento nocturno de los que quedaron en la bandeja.
     */
    const procesar = async (invoice: AlegraInvoice, monto: number): Promise<Resultado> => {
      const { candidates, auto, reason, splitIds } = matchInvoice(invoice, alumnos, tutores)

      // Comprobante del tutor con varios hijos: se atribuye solo si hay una
      // única combinación de hermanos con la que el monto cuadra exacto.
      if (!auto && splitIds && splitIds.length >= 1) {
        const cuotas: Record<string, number | null> = {}
        for (const id of splitIds) cuotas[id] = await cuotaMensual(id)
        const reparto = splitByTuition(monto, splitIds, cuotas)
        if (!reparto) return { tipo: 'revision', motivo: reason ?? 'conjunto', candidates, asignado: 0 }
        for (const parte of reparto) {
          if (await pareceDuplicado(parte.studentId, parte.amount, invoice.date)) {
            return { tipo: 'revision', motivo: 'posible_duplicado', candidates, asignado: 0 }
          }
        }
        let asignado = 0
        for (const parte of reparto) {
          const alumno = alumnos.find((s) => s.id === parte.studentId)
          const ok = alumno ? await registrar(alumno, parte.amount, invoice, reparto.length > 1 ? 'repartido entre hermanos según sus cuotas' : 'comprobante del tutor: el monto cuadra solo con la cuota de este hijo') : false
          if (!ok) {
            // Se registró solo una parte: lo que falta queda en la bandeja.
            return asignado > 0
              ? { tipo: 'revision', motivo: 'conjunto', candidates, asignado }
              : { tipo: 'saltado' }
          }
          asignado = Math.round((asignado + parte.amount) * 100) / 100
        }
        return { tipo: 'cargado', monto: asignado }
      }

      if (!auto) return { tipo: 'revision', motivo: reason ?? 'sin_emparejar', candidates, asignado: 0 }
      if (await pareceDuplicado(auto.studentId, monto, invoice.date)) {
        return { tipo: 'revision', motivo: 'posible_duplicado', candidates, asignado: 0 }
      }
      const alumno = alumnos.find((s) => s.id === auto.studentId)
      if (!alumno || !(await registrar(alumno, monto, invoice))) return { tipo: 'saltado' }
      // Aprende la matrícula: si este cobro trae una matrícula (IE) y el
      // estudiante aún no la tiene, se guarda para los próximos.
      if (!alumno.student_code) {
        await learnStudentCode(schoolId, alumno.id, invoice.clientIdentificationType, invoice.clientIdentification)
      }
      return { tipo: 'cargado', monto }
    }

    // ── 1. Reintento de lo que quedó en la bandeja ──────────────────────
    // Cada noche se vuelve a evaluar lo pendiente sin asignar: si desde
    // entonces se dio de alta al estudiante, se vinculó su matrícula o la
    // regla ya alcanza, se carga solo. Lo que sigue dudoso se queda igual.
    for (const fila of (enBandeja ?? []).filter((r) => r.status === 'pendiente' && Number(r.assigned_amount) === 0)) {
      const monto = Number(fila.amount)
      if (!(monto > 0)) continue
      const invoice: AlegraInvoice = {
        id: String(fila.alegra_invoice_id),
        date: String(fila.alegra_date),
        status: 'closed',
        fullNumber: (fila.alegra_number as string | null) ?? null,
        clientName: (fila.alegra_client_name as string | null) ?? null,
        clientIdentification: (fila.alegra_client_identification as string | null) ?? null,
        clientIdentificationType: (fila.alegra_client_id_type as string | null) ?? null,
        total: monto,
        balance: 0,
        paymentMethod: (fila.alegra_payment_method as string | null) ?? null,
        note: (fila.alegra_note as string | null) ?? null,
        items: [{ name: 'Mensualidad', total: monto }],
      }
      const r = await procesar(invoice, monto)
      if (r.tipo === 'cargado') {
        await admin.from('alegra_payment_matches').update({
          assigned_amount: r.monto,
          status: 'cargado',
          resolved_at: new Date().toISOString(),
          resolution_note: 'Resuelto automáticamente en la conciliación (reintento).',
          updated_at: new Date().toISOString(),
        }).eq('id', fila.id).eq('status', 'pendiente')
        loadedCount++
        loadedAmount += r.monto
        if (invoice.fullNumber) referenciasCargadas.add(invoice.fullNumber)
      } else if (r.tipo === 'revision' && r.asignado > 0) {
        await admin.from('alegra_payment_matches').update({
          assigned_amount: r.asignado, updated_at: new Date().toISOString(),
        }).eq('id', fila.id)
      }
    }

    // ── 2. Cobros nuevos de Alegra ──────────────────────────────────────
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

      const r = await procesar(invoice, monto)
      if (r.tipo === 'saltado') { skippedCount++; continue }
      if (r.tipo === 'cargado') {
        loadedCount++
        loadedAmount += r.monto
        if (invoice.fullNumber) referenciasCargadas.add(invoice.fullNumber)
        continue
      }

      const filaBandeja = {
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
        assigned_amount: r.asignado,
        reason: r.motivo,
        candidates: r.candidates,
      }
      const { error: errorBandeja } = await admin.from('alegra_payment_matches').insert(filaBandeja)
      if (errorBandeja && filaBandeja.reason === 'nota_distinta') {
        // Red de seguridad si la migración 20261109000000 (que agrega
        // 'nota_distinta' al CHECK) aún no está aplicada: el cobro igual
        // llega a la bandeja, como 'ambiguo', en vez de quedarse fuera.
        await admin.from('alegra_payment_matches').insert({ ...filaBandeja, reason: 'ambiguo' })
      }
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
