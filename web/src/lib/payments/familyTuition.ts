import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  futureUnpaidInstallments,
  normalizePrepayTiers,
  todayInDominicanRepublic,
  type FutureInstallment,
  type Installment,
  type PrepayTier,
} from './tuitionPlan'

/**
 * Mensualidad de cada hijo de UNA familia, para el Portal Familiar.
 *
 * Lee la deuda con la MISMA función que Tesorería → Cuentas por Cobrar
 * (calculate_receivable_breakdown), así el padre ve exactamente lo que ve
 * el colegio: la cuota del mes aparece desde el día 25, con su recargo si
 * ya venció. Nada de esto es una factura: el colegio no factura por
 * adelantado.
 *
 * Usa el cliente admin, siempre filtrando por la familia y el colegio que
 * ya resolvió la sesión (resolveGuardianIdentity) -- nunca por un id que
 * mande el navegador sin verificar.
 */

export interface StudentTuition {
  studentId: string
  studentName: string
  monthlyAmount: number
  currentAmount: number
  overduePrincipal: number
  lateFee: number
  totalDue: number
  oldestReference: string | null
  future: FutureInstallment[]
  /**
   * Año escolar completo pagado (student_tuition_year_status, incluye el
   * descuento por pago adelantado). Trato VIP: el portal lo celebra y el
   * bloqueo por mora nunca le aplica.
   */
  yearPaid: boolean
  /** Último mes cubierto por lo pagado ('YYYY-MM-DD', primer día del mes), o null. */
  paidThroughMonth: string | null
  /**
   * Mensualidad normal del nivel (sin beca ni hermanos), solo si la cuota del
   * estudiante es distinta; null si paga la cuota normal.
   */
  regularMonthly: number | null
  /** Descuentos que explican su cuota ("Beca 50%", "Hermanos 10%"), vacío si no tiene. */
  discountLabels: string[]
}

export interface FamilyTuitionOverview {
  students: StudentTuition[]
  prepayEnabled: boolean
  prepayTiers: PrepayTier[]
  asOf: string
}

interface BreakdownRow {
  monthly_amount: number | null
  collected_amount: number | null
  current_amount: number | null
  overdue_principal_amount: number | null
  late_fee_amount: number | null
  total_due_amount: number | null
  oldest_overdue_reference: string | null
  aging_bucket: string | null
}

interface BasisRow {
  school_level: string | null
  monthly_amount: number | null
  installments: number | null
  due_day: number | null
  grace_days: number | null
  year_start_date: string | null
  configured: boolean
}

interface YearStatusRow {
  year_paid: boolean | null
  paid_through_month: string | null
}

interface ScheduleRow {
  period_month: string
  amount: number
}

interface StudentRow {
  id: string
  first_name: string
  last_name: string
  tuition_discount_percent: number | null
  tuition_override_amount: number | null
}

/** Mensualidad de cada nivel del colegio (schools.tuition_*_amount). */
type LevelAmounts = Record<string, number | null | undefined>

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)}%`

async function loadStudentTuition(
  admin: ReturnType<typeof createAdminClient>,
  student: StudentRow,
  asOf: string,
  levelAmounts: LevelAmounts,
): Promise<StudentTuition | null> {
  const [
    { data: breakdown, error: breakdownError },
    { data: basis, error: basisError },
    { data: yearStatus, error: yearError },
    { data: sibling },
  ] = await Promise.all([
    admin.rpc('calculate_receivable_breakdown', { p_student_id: student.id, p_as_of: asOf }).maybeSingle(),
    admin.rpc('student_tuition_basis', { p_student_id: student.id }).maybeSingle(),
    admin.rpc('student_tuition_year_status', { p_student_id: student.id }).maybeSingle(),
    admin.rpc('calculate_sibling_discount', { p_student_id: student.id }).maybeSingle(),
  ])
  if (breakdownError) console.error('[familyTuition] deuda', breakdownError.message)
  if (basisError) console.error('[familyTuition] base', basisError.message)
  if (yearError) console.error('[familyTuition] año pagado', yearError.message)
  const year = yearStatus as YearStatusRow | null

  const row = breakdown as BreakdownRow | null
  const base = basis as BasisRow | null
  // Sin mensualidad configurada para su nivel no hay nada que mostrar.
  if (!row || row.aging_bucket === 'sin_configurar' || !base?.configured || !base.year_start_date) return null

  const { data: scheduleRaw, error: scheduleError } = await admin.rpc('installment_schedule', {
    p_start_date: base.year_start_date,
    p_installments: base.installments,
    p_due_day: base.due_day,
    p_grace_days: base.grace_days,
    p_monthly_amount: base.monthly_amount,
  })
  if (scheduleError) console.error('[familyTuition] calendario', scheduleError.message)

  const schedule: Installment[] = ((scheduleRaw ?? []) as ScheduleRow[]).map((c) => ({
    periodMonth: String(c.period_month).slice(0, 10),
    amount: Number(c.amount),
  }))

  // De dónde sale su cuota, para que el padre vea su beca en vez de una
  // cuota "normal" que no es la suya (reporte del colegio, 2026-11-25).
  const monthlyAmount = Number(row.monthly_amount ?? 0)
  const levelRaw = base.school_level ? levelAmounts[base.school_level] : null
  const levelAmount = levelRaw != null ? Number(levelRaw) : null
  const discountLabels: string[] = []
  const scholarshipPct = student.tuition_discount_percent != null ? Number(student.tuition_discount_percent) : 0
  if (scholarshipPct > 0) discountLabels.push(`Beca ${pct(scholarshipPct)}`)
  else if (student.tuition_override_amount != null) discountLabels.push('Cuota especial')
  const siblingPct = Number((sibling as { discount_percent: number | null } | null)?.discount_percent ?? 0)
  if (siblingPct > 0) discountLabels.push(`Descuento por hermanos ${pct(siblingPct)}`)
  const regularMonthly = levelAmount != null && Math.abs(levelAmount - monthlyAmount) > 0.009 ? levelAmount : null

  return {
    studentId: student.id,
    studentName: `${student.first_name} ${student.last_name}`.trim(),
    monthlyAmount,
    currentAmount: Number(row.current_amount ?? 0),
    overduePrincipal: Number(row.overdue_principal_amount ?? 0),
    lateFee: Number(row.late_fee_amount ?? 0),
    totalDue: Number(row.total_due_amount ?? 0),
    oldestReference: row.oldest_overdue_reference,
    future: futureUnpaidInstallments(schedule, Number(row.collected_amount ?? 0), asOf),
    yearPaid: year?.year_paid === true,
    paidThroughMonth: year?.paid_through_month ? String(year.paid_through_month).slice(0, 10) : null,
    regularMonthly,
    discountLabels,
  }
}

export async function getFamilyTuitionOverview(params: {
  schoolId: string
  familyId: string
  /** Solo un hijo (al iniciar un pago); si no, todos los inscritos. */
  studentId?: string
}): Promise<FamilyTuitionOverview> {
  const admin = createAdminClient()
  const asOf = todayInDominicanRepublic()

  let studentsQuery = admin
    .from('students')
    .select('id, first_name, last_name, tuition_discount_percent, tuition_override_amount')
    .eq('school_id', params.schoolId)
    .eq('family_id', params.familyId)
    .eq('enrollment_status', 'inscrito')
    .is('deleted_at', null)
    .order('first_name')
  if (params.studentId) studentsQuery = studentsQuery.eq('id', params.studentId)

  const [{ data: studentsRaw, error: studentsError }, { data: school }] = await Promise.all([
    studentsQuery,
    admin.from('schools')
      .select('prepay_enabled, prepay_discount_tiers, tuition_parvulo_amount, tuition_inicial_amount, tuition_primaria_amount, tuition_secundaria_amount')
      .eq('id', params.schoolId).maybeSingle(),
  ])
  if (studentsError) console.error('[familyTuition] estudiantes', studentsError.message)
  const levelAmounts: LevelAmounts = {
    parvulo: school?.tuition_parvulo_amount,
    inicial: school?.tuition_inicial_amount,
    primaria: school?.tuition_primaria_amount,
    secundaria: school?.tuition_secundaria_amount,
  }

  const students = (
    await Promise.all(((studentsRaw ?? []) as StudentRow[]).map((s) => loadStudentTuition(admin, s, asOf, levelAmounts)))
  ).filter((s): s is StudentTuition => s !== null)

  return {
    students,
    prepayEnabled: school?.prepay_enabled ?? false,
    prepayTiers: normalizePrepayTiers(school?.prepay_discount_tiers),
    asOf,
  }
}
