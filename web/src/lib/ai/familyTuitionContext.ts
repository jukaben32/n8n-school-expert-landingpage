/**
 * Texto de "Mensualidades" para el contexto del asistente de IA de la
 * familia (chat y llamada de voz). Función pura y SIN imports (así se
 * prueba con node: scripts/test-family-tuition-context.mjs): recibe lo que
 * ya calculó getFamilyTuitionOverview (la misma cuenta que ve el padre en
 * Pagos y el colegio en Cuentas por Cobrar) y el ejemplo de adelanto ya
 * calculado con buildTuitionQuote. Así el asistente nunca da un monto
 * distinto al de la pantalla.
 */

interface PrepayTier {
  months: number
  percent: number
}

/** Ejemplo de adelanto ya calculado con buildTuitionQuote (mismas reglas que el portal). */
export interface PrepayExample {
  monthsAhead: number
  discountPercent: number
  prepayGross: number
  prepayDiscount: number
  total: number
}

export interface TuitionContextStudent {
  studentName: string
  monthlyAmount: number
  currentAmount: number
  overduePrincipal: number
  lateFee: number
  totalDue: number
  oldestReference: string | null
  /** Meses que quedan por pagar este año, ya con nombre ("diciembre 2026"). */
  futureMonthNames: string[]
  prepayExample: PrepayExample | null
}

export interface TuitionContextInput {
  students: TuitionContextStudent[]
  prepayEnabled: boolean
  prepayTiers: PrepayTier[]
  /** Estado del pago con tarjeta del colegio (schoolCardPaymentMode). */
  cardMode: 'production' | 'test' | 'none'
  asOf: string
}

const dop = (amount: number) => `RD$${amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function studentLine(s: TuitionContextStudent): string {
  const parts = [`cuota mensual ${dop(s.monthlyAmount)}`]
  if (s.totalDue <= 0) {
    parts.push('está al día')
  } else {
    if (s.currentAmount > 0) parts.push(`cuota del mes pendiente ${dop(s.currentAmount)}`)
    if (s.overduePrincipal > 0) parts.push(`cuotas vencidas ${dop(s.overduePrincipal)}${s.oldestReference ? ` (desde ${s.oldestReference})` : ''}`)
    if (s.lateFee > 0) parts.push(`recargo por mora ${dop(s.lateFee)}`)
    parts.push(`TOTAL A PAGAR HOY ${dop(s.totalDue)}`)
  }
  const months = s.futureMonthNames
  if (months.length > 0) {
    const range = months.length === 1 ? months[0] : `${months[0]} a ${months[months.length - 1]}`
    parts.push(`le quedan ${months.length} ${months.length === 1 ? 'mes' : 'meses'} por pagar este año escolar (${range})`)
  } else {
    parts.push('no le quedan meses futuros por pagar este año escolar')
  }
  return `- ${s.studentName}: ${parts.join('; ')}.`
}

function tiersText(tiers: PrepayTier[]): string {
  if (tiers.length === 0) return 'El colegio no tiene descuento por pago adelantado: los meses adelantados se pagan al precio normal.'
  const list = tiers.map((t) => `desde ${t.months} ${t.months === 1 ? 'mes' : 'meses'}, ${t.percent}%`).join('; ')
  return `Descuento por pago adelantado: ${list}. Se aplica el nivel más alto que alcance la cantidad de meses adelantados, y SOLO sobre esos meses futuros (nunca sobre cuotas vencidas ni sobre el recargo).`
}

/** Ejemplo concreto para que el asistente pueda dar un monto real. */
function prepayExampleLine(s: TuitionContextStudent): string | null {
  const e = s.prepayExample
  if (!e || e.discountPercent <= 0) return null
  return `- Ejemplo para ${s.studentName}: adelantar ${e.monthsAhead} meses son ${dop(e.prepayGross)}, con ${e.discountPercent}% de descuento (−${dop(e.prepayDiscount)}) queda en ${dop(e.total)}${s.totalDue > 0 ? `, más lo que debe hoy (${dop(s.totalDue)})` : ''}.`
}

export function buildTuitionContextText(input: TuitionContextInput): string {
  if (input.students.length === 0) {
    return 'Mensualidades: no hay mensualidad configurada para los hijos de esta familia.'
  }

  const lines = [
    `Mensualidades al ${input.asOf} (mismo cálculo que el colegio en Cuentas por Cobrar):`,
    ...input.students.map(studentLine),
    '',
    'Reglas de la mensualidad:',
    '- La cuota de cada mes aparece como pendiente a partir del día 25 de ese mes. Antes del 25 no se debe todavía.',
    '- Si no se paga a tiempo, la cuota vencida genera un recargo por mora que solo crece mientras siga sin pagar. Al pagar la cuota, ese recargo se paga junto con ella.',
    '- En "Total a pagar" de Pagos se suma lo de todos los hijos.',
  ]

  if (input.cardMode === 'production') {
    lines.push(
      '',
      'Cómo pagar la mensualidad con tarjeta (explícalo paso a paso si lo pide):',
      '1. En el Portal Familiar, entrar a "Pagos" (o tocar el aviso "Mensualidad pendiente" de la portada).',
      '2. En la sección "Mensualidades", cada hijo tiene su tarjeta con lo que debe hoy.',
      input.prepayEnabled
        ? '3. Si quiere adelantar meses, usar los botones − y + de "Adelantar meses": ahí ve los meses incluidos, el descuento y el total actualizado.'
        : '3. Este colegio no permite adelantar meses por el portal; para eso debe consultar en secretaría.',
      '4. Tocar "Pagar RD$… con tarjeta". Se abre la página segura de AZUL (Banco Popular), donde escribe los datos de la tarjeta Visa o Mastercard. El colegio nunca ve el número de la tarjeta.',
      '5. Al volver al portal ve si el pago fue aprobado, y le llega el recibo por correo al tutor principal. El monto que se cobra es exactamente el que se mostró en pantalla.',
    )
  } else if (input.cardMode === 'test') {
    lines.push(
      '',
      'Pago con tarjeta: el colegio lo está terminando de habilitar con AZUL y TODAVÍA NO está disponible para las familias. No le digas que puede pagar con tarjeta ni que busque un botón de pago. Por ahora puede pagar en la secretaría del colegio o por transferencia. En "Pagos" sí puede ver cuánto debe de cada hijo.',
    )
  } else {
    lines.push('', 'Pago con tarjeta: no está disponible en este colegio. Puede pagar en la secretaría del colegio o por transferencia. En "Pagos" puede ver cuánto debe de cada hijo.')
  }

  if (input.prepayEnabled && input.cardMode === 'production') {
    lines.push('', 'Pago de meses por adelantado:', `- ${tiersText(input.prepayTiers)}`)
    const examples = input.students.map(prepayExampleLine).filter((e): e is string => e !== null)
    lines.push(...examples)
    lines.push('- Si el estudiante se retira, los meses adelantados que no se cursaron se revisan según la política de reembolsos del colegio.')
  }

  return lines.join('\n')
}
