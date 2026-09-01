'use client'

import type { CSSProperties } from 'react'

/* =========================================================================
   PanelCentroControl — contenido del Panel de dirección/secretaría
   Usado desde web/src/app/dashboard/secretaria/page.tsx, que hace las
   consultas reales a Supabase y le pasa los datos ya calculados.

   Todos los estilos van inline (o en las clases .dash-* de globals.css),
   así que no depende de ninguna config de Tailwind extra.
   Los props son opcionales: sin ellos renderiza los datos de muestra del
   diseño, para poder verlo antes de conectar Supabase.
   ========================================================================= */

const C = {
  text: '#eaf6f1',
  muted: '#93b6a9',
  faint: '#7f9f93',
  soft: '#9dbfb2',
  accent: '#4ade9f',
  accentLight: '#6ee7b7',
  warning: '#e6bd63',
  danger: '#ff9d90',
  dangerSoft: '#e08a7e',
  hair: 'rgba(150,225,196,.14)',
  hairSoft: 'rgba(150,225,196,.08)',
  hairStrong: 'rgba(150,225,196,.18)',
  chip: 'rgba(255,255,255,.07)',
  cond: "'Barlow Condensed', sans-serif",
}

const card: CSSProperties = {
  borderRadius: 16,
  border: `1px solid ${C.hair}`,
  background: 'rgba(6,45,34,.74)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 16px 38px rgba(0,26,18,.28), inset 0 1px 0 rgba(255,255,255,.12)',
}
const cardDanger: CSSProperties = {
  ...card,
  border: '1px solid rgba(255,157,144,.4)',
  background: 'linear-gradient(155deg, rgba(208,69,58,.28), rgba(208,69,58,.06)), rgba(6,45,34,.82)',
}
const cardAccent: CSSProperties = {
  ...card,
  border: '1px solid rgba(150,225,196,.32)',
  background: 'linear-gradient(155deg, rgba(16,185,129,.3), rgba(16,185,129,.05)), rgba(6,45,34,.84)',
}
const kicker: CSSProperties = {
  fontFamily: C.cond, fontSize: 11, letterSpacing: '.16em',
  textTransform: 'uppercase', color: C.muted,
}
const cardTitle: CSSProperties = {
  fontFamily: C.cond, fontSize: 16, fontWeight: 700, letterSpacing: '.02em',
}
const bigNum: CSSProperties = {
  fontFamily: C.cond, fontSize: 38, fontWeight: 700, lineHeight: .9,
}
const tag = (color: string, border: string): CSSProperties => ({
  fontFamily: C.cond, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase',
  padding: '2px 9px', borderRadius: 999, border: `1px solid ${border}`, color,
})

/* ------------------------------- tipos ---------------------------------- */
export type CashflowMonth = { label: string; paid: number; pending: number; overdue: number }
export type OverdueRow = { family: string; students: string; due: string; amount: string; status: string; level: 'alto' | 'medio' | 'bajo' }
export type AlertRow = { title: string; detail: string; count: string; level: 'alto' | 'medio' | 'bajo' }
export type Insight = { text: string; action: string; href?: string }

export interface PanelProps {
  students?: { total: number; delta: string; spark: number[] }
  families?: { total: number; withAccess: number; pct: number }
  attendance?: { pct: string; delta: string; spark: number[]; series: number[]; note: string; label: string }
  collected?: { amount: string; pctOfGoal: number }
  overdue?: { amount: string; invoices: number; families: number }
  enrollment?: { enrolled: number; inProcess: number; withdrawn: number }
  cashflow?: CashflowMonth[]
  overdueRows?: OverdueRow[]
  alerts?: AlertRow[]
  insights?: Insight[]
  showInsights?: boolean
}

const LEVEL: Record<'alto' | 'medio' | 'bajo', { color: string; border: string }> = {
  alto:  { color: C.danger,  border: 'rgba(255,157,144,.45)' },
  medio: { color: C.warning, border: 'rgba(230,189,99,.45)' },
  bajo:  { color: C.soft,    border: 'rgba(150,225,196,.35)' },
}

/* --------------------------- datos de muestra --------------------------- */
const D = {
  students: { total: 486, delta: '+12 este mes', spark: [42, 48, 45, 55, 60, 58, 66, 72, 70, 78, 85, 92] },
  families: { total: 312, withAccess: 274, pct: 88 },
  attendance: {
    pct: '94.2%', delta: '-1.4 pts', label: '7 días',
    spark: [88, 92, 95, 91, 96, 94, 97, 93, 90, 95, 92, 89],
    series: [96, 95, 97, 94, 93, 95, 96, 94, 92, 95, 96, 93, 91, 94, 95, 96, 94, 88, 92, 95],
    note: 'Promedio 94.2% · mínimo 88.1% el lunes 12',
  },
  collected: { amount: 'RD$ 2.41M', pctOfGoal: 78 },
  overdue: { amount: 'RD$ 386K', invoices: 31, families: 24 },
  enrollment: { enrolled: 417, inProcess: 43, withdrawn: 26 },
  // Año escolar de este colegio: agosto (medio mes, el período inicia el 17)
  // a junio -- julio queda fuera, vacaciones colectivas sin cobro.
  cashflow: [
    { label: 'Ago', paid: 66, pending: 12, overdue: 9 },
    { label: 'Sep', paid: 62, pending: 8, overdue: 4 },
    { label: 'Oct', paid: 66, pending: 7, overdue: 5 },
    { label: 'Nov', paid: 59, pending: 10, overdue: 6 },
    { label: 'Dic', paid: 48, pending: 12, overdue: 9 },
    { label: 'Ene', paid: 71, pending: 8, overdue: 4 },
    { label: 'Feb', paid: 68, pending: 9, overdue: 5 },
    { label: 'Mar', paid: 74, pending: 7, overdue: 4 },
    { label: 'Abr', paid: 63, pending: 11, overdue: 7 },
    { label: 'May', paid: 70, pending: 9, overdue: 6 },
    { label: 'Jun', paid: 58, pending: 13, overdue: 11 },
  ] as CashflowMonth[],
  overdueRows: [
    { family: 'Familia Rodríguez Paulino', students: 'Sofía, Diego', due: '02 ago', amount: 'RD$ 42,300', status: '+21 días', level: 'alto' },
    { family: 'Familia Encarnación', students: 'Miguel Á.', due: '10 ago', amount: 'RD$ 28,900', status: '+13 días', level: 'medio' },
    { family: 'Familia Guzmán Reyes', students: 'Camila, Luis, Ana', due: '12 ago', amount: 'RD$ 51,400', status: '+11 días', level: 'medio' },
    { family: 'Familia Batista Cruz', students: 'Isabella', due: '15 ago', amount: 'RD$ 14,500', status: '+8 días', level: 'medio' },
    { family: 'Familia Peña Mejía', students: 'Luis M., Ana P.', due: '18 ago', amount: 'RD$ 29,000', status: '+5 días', level: 'bajo' },
  ] as OverdueRow[],
  alerts: [
    { title: 'Ausencias sin justificar', detail: 'Hoy · requieren llamada a la familia', count: '7', level: 'alto' },
    { title: 'Autorizaciones sin respuesta', detail: 'Excursión 5.º · cierra mañana', count: '18', level: 'medio' },
    { title: 'Comprobantes por validar', detail: 'Transferencias subidas por familias', count: '14', level: 'medio' },
    { title: 'Registros de personal pendientes', detail: 'Formulario público de contratación', count: '3', level: 'bajo' },
  ] as AlertRow[],
  insights: [
    { text: 'La ausencia de 3.º B subió 9 puntos en dos semanas; 4 de esos 7 casos también tienen factura vencida.', action: 'Ver los 7 casos →', href: '/dashboard/asistencia' },
    { text: 'Los comunicados enviados después de las 4 p.m. se leen 38% menos. El de mañana está programado a las 5:10 p.m.', action: 'Reprogramar →', href: '/dashboard/comunicados' },
    { text: 'Si se cobra la mora de las 8 familias con mayor saldo, se cierra la meta del mes sin gestionar el resto.', action: 'Enviar recordatorios →', href: '/dashboard/tesoreria' },
  ] as Insight[],
}

/* ------------------------------ subpiezas ------------------------------- */
function Spark({ values }: { values: number[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 28, marginTop: 12 }}>
      {values.map((v, i) => (
        <div key={i} style={{
          flex: 1, height: `${v}%`, borderRadius: 3, transformOrigin: 'bottom',
          background: 'linear-gradient(180deg,#6ee7b7,#10b981)',
          animation: 'riseBar .6s ease-out both',
        }} />
      ))}
    </div>
  )
}

function Meter({ pct }: { pct: number }) {
  return (
    <div style={{ marginTop: 12, height: 7, borderRadius: 999, overflow: 'hidden', background: 'rgba(150,225,196,.12)' }}>
      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: 'linear-gradient(90deg,#10b981,#6ee7b7)' }} />
    </div>
  )
}

const GRID = '1.6fr 1.4fr .9fr .9fr .9fr'

/* ------------------------------ componente ------------------------------ */
export default function PanelCentroControl(p: PanelProps) {
  const students = p.students ?? D.students
  const families = p.families ?? D.families
  const attendance = p.attendance ?? D.attendance
  const collected = p.collected ?? D.collected
  const overdue = p.overdue ?? D.overdue
  const enrollment = p.enrollment ?? D.enrollment
  const cashflow = p.cashflow ?? D.cashflow
  const overdueRows = p.overdueRows ?? D.overdueRows
  const alerts = p.alerts ?? D.alerts
  const insights = p.insights ?? D.insights
  const showInsights = p.showInsights ?? true

  // Línea de asistencia: escala 85–100% sobre un viewBox de 320×100
  const pts = attendance.series.map((v, i) => {
    const x = (i / (attendance.series.length - 1)) * 320
    const y = 100 - ((v - 85) / 15) * 85
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const line = pts.join(' ')
  const area = `0,100 ${line} 320,100`

  // Dona de matrícula: circunferencia = 2πr con r=16 ≈ 100.5
  const totalEnr = enrollment.enrolled + enrollment.inProcess + enrollment.withdrawn
  const seg = (n: number) => (n / totalEnr) * 100.5
  const sEnrolled = seg(enrollment.enrolled)
  const sProcess = seg(enrollment.inProcess)
  const sOut = seg(enrollment.withdrawn)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, color: C.text, fontSize: 14 }}>

      {/* ---------------------------- KPIs ---------------------------- */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ ...card, flex: '1 1 180px', minWidth: 0, padding: 16 }}>
          <div style={kicker}>Estudiantes inscritos</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 8 }}>
            <div style={bigNum}>{students.total}</div>
            <div style={{ fontSize: 12, color: C.accent, paddingBottom: 5, whiteSpace: 'nowrap' }}>{students.delta}</div>
          </div>
          <Spark values={students.spark} />
        </div>

        <div style={{ ...card, flex: '1 1 180px', minWidth: 0, padding: 16 }}>
          <div style={kicker}>Familias registradas</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 8 }}>
            <div style={bigNum}>{families.total}</div>
            <div style={{ fontSize: 12, color: C.muted, paddingBottom: 5, whiteSpace: 'nowrap' }}>{families.withAccess} con acceso</div>
          </div>
          <Meter pct={families.pct} />
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{families.pct}% activó el portal</div>
        </div>

        <div style={{ ...card, flex: '1 1 180px', minWidth: 0, padding: 16 }}>
          <div style={kicker}>Asistencia ({attendance.label})</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 8 }}>
            <div style={bigNum}>{attendance.pct}</div>
            <div style={{ fontSize: 12, color: C.warning, paddingBottom: 5, whiteSpace: 'nowrap' }}>{attendance.delta}</div>
          </div>
          <Spark values={attendance.spark} />
        </div>

        <div style={{ ...card, flex: '1 1 180px', minWidth: 0, padding: 16 }}>
          <div style={kicker}>Cobrado este mes</div>
          <div style={{ ...bigNum, fontSize: 36, marginTop: 8, whiteSpace: 'nowrap' }}>{collected.amount}</div>
          <div style={{ fontSize: 12, color: C.accent, marginTop: 6 }}>{collected.pctOfGoal}% de la meta mensual</div>
          <Meter pct={collected.pctOfGoal} />
        </div>

        <div style={{ ...cardDanger, flex: '1 1 180px', minWidth: 0, padding: 16 }}>
          <div style={{ ...kicker, color: C.danger }}>Cartera vencida</div>
          <div style={{ ...bigNum, fontSize: 36, marginTop: 8, whiteSpace: 'nowrap', color: C.danger }}>{overdue.amount}</div>
          <div style={{ fontSize: 12, color: '#e3a79e', marginTop: 6 }}>{overdue.invoices} facturas · {overdue.families} familias</div>
          <a href="/dashboard/tesoreria" style={{
            display: 'inline-block', marginTop: 10, fontFamily: C.cond, fontSize: 12,
            letterSpacing: '.08em', textTransform: 'uppercase', color: C.danger,
            borderBottom: '1px solid rgba(255,157,144,.45)', textDecoration: 'none',
          }}>Ver gestión de moras</a>
        </div>
      </div>

      {/* ------------------------ dos columnas ------------------------ */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>

        {/* columna ancha */}
        <div style={{ flex: '3 1 600px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* flujo de cobranza */}
          <div style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ ...cardTitle, fontSize: 18 }}>FLUJO DE COBRANZA · AÑO ESCOLAR</div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 14, fontSize: 11, color: C.muted }}>
                {[['Cobrado', C.accent], ['Pendiente', 'rgba(150,225,196,.28)'], ['Vencido', C.dangerSoft]].map(([l, c]) => (
                  <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: c }} />{l}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 200, borderBottom: `1px solid ${C.hairStrong}` }}>
              {cashflow.map((m) => (
                <div key={m.label} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                  height: '100%', borderRadius: 5, overflow: 'hidden', transformOrigin: 'bottom',
                  animation: 'riseBar .7s cubic-bezier(.2,.7,.2,1) both',
                }}>
                  <div style={{ background: C.dangerSoft, height: `${m.overdue}%` }} />
                  <div style={{ background: 'rgba(150,225,196,.28)', height: `${m.pending}%` }} />
                  <div style={{ background: 'linear-gradient(180deg,#16c78f,#0b8259)', height: `${m.paid}%` }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {cashflow.map((m, i) => (
                <div key={m.label} style={{
                  flex: 1, textAlign: 'center', fontFamily: C.cond, fontSize: 12,
                  letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted,
                }}>{m.label}{i === 0 ? '*' : ''}</div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 10 }}>
              * Agosto es medio mes (el período inicia el 17) — julio no se muestra por las vacaciones colectivas de los estudiantes. El año escolar completo son 10.5 meses de cobro.
            </div>
          </div>

          {/* asistencia + matrícula */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px,1fr))', gap: 16 }}>
            <div style={{ ...card, padding: 18 }}>
              <div style={{ ...cardTitle, marginBottom: 4 }}>ASISTENCIA DIARIA · ÚLTIMAS 4 SEMANAS</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{attendance.note}</div>
              <svg viewBox="0 0 320 110" style={{ width: '100%', height: 130, overflow: 'visible' }}>
                <line x1="0" y1="20" x2="320" y2="20" stroke="rgba(150,225,196,.12)" strokeWidth="1" />
                <line x1="0" y1="55" x2="320" y2="55" stroke="rgba(150,225,196,.12)" strokeWidth="1" />
                <line x1="0" y1="90" x2="320" y2="90" stroke="rgba(150,225,196,.2)" strokeWidth="1" />
                <polygon points={area} fill="rgba(16,185,129,.22)" />
                <polyline points={line} fill="none" stroke={C.accent} strokeWidth="2"
                  strokeDasharray="900" style={{ animation: 'drawLine 1.4s ease-out both' }} />
              </svg>
              <div style={{
                display: 'flex', justifyContent: 'space-between', fontFamily: C.cond, fontSize: 11,
                letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted, marginTop: 6,
              }}>
                <span>Sem 1</span><span>Sem 2</span><span>Sem 3</span><span>Sem 4</span>
              </div>
            </div>

            <div style={{ ...card, padding: 18 }}>
              <div style={{ ...cardTitle, marginBottom: 14 }}>ESTADO DE MATRÍCULA</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <svg viewBox="0 0 42 42" style={{ width: 104, height: 104, transform: 'rotate(-90deg)', flex: '0 0 auto' }}>
                  <circle cx="21" cy="21" r="16" fill="none" stroke="rgba(150,225,196,.14)" strokeWidth="7" />
                  <circle cx="21" cy="21" r="16" fill="none" stroke="#10b981" strokeWidth="7"
                    strokeDasharray={`${sEnrolled} 100.5`} strokeDashoffset="0" />
                  <circle cx="21" cy="21" r="16" fill="none" stroke="#7ddcb4" strokeWidth="7"
                    strokeDasharray={`${sProcess} 100.5`} strokeDashoffset={-sEnrolled} />
                  <circle cx="21" cy="21" r="16" fill="none" stroke={C.dangerSoft} strokeWidth="7"
                    strokeDasharray={`${sOut} 100.5`} strokeDashoffset={-(sEnrolled + sProcess)} />
                </svg>
                <div style={{ flex: '1 1 130px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13 }}>
                  {([['Inscritos', C.accent, enrollment.enrolled],
                     ['En proceso', '#7ddcb4', enrollment.inProcess],
                     ['Retirados', C.dangerSoft, enrollment.withdrawn]] as const).map(([l, c, n]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: c }} />
                      {l}<strong style={{ marginLeft: 'auto' }}>{n}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* tabla de mora */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px 12px' }}>
              <div style={cardTitle}>FAMILIAS CON SALDO VENCIDO</div>
              <div style={{ flex: 1 }} />
              <a href="/dashboard/tesoreria" style={{
                fontFamily: C.cond, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase',
                color: C.accent, textDecoration: 'none', borderBottom: '1px solid rgba(150,225,196,.4)',
              }}>Abrir tesorería</a>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: GRID, gap: 10, padding: '8px 18px',
              borderTop: `1px solid ${C.hair}`, borderBottom: `1px solid ${C.hair}`,
              fontFamily: C.cond, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted,
            }}>
              <div>Familia</div><div>Estudiantes</div><div>Vence</div>
              <div style={{ textAlign: 'right' }}>Monto</div><div style={{ textAlign: 'right' }}>Estado</div>
            </div>
            {overdueRows.map((r) => (
              <div key={r.family} style={{
                display: 'grid', gridTemplateColumns: GRID, gap: 10, padding: '11px 18px',
                borderBottom: `1px solid ${C.hairSoft}`, fontSize: 13, alignItems: 'center',
              }}>
                <div style={{ fontWeight: 600 }}>{r.family}</div>
                <div style={{ color: C.soft }}>{r.students}</div>
                <div style={{ color: C.soft }}>{r.due}</div>
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.amount}</div>
                <div style={{ textAlign: 'right' }}>
                  <span style={tag(LEVEL[r.level].color, LEVEL[r.level].border)}>{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* columna lateral */}
        <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {showInsights && (
            <div style={{ ...cardAccent, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.accentLight} strokeWidth="1.5" strokeLinejoin="round">
                  <path d="M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4L12 3z" />
                </svg>
                <div style={{ ...cardTitle, letterSpacing: '.06em' }}>LECTURA DEL DÍA</div>
                <span style={{
                  width: 8, height: 8, borderRadius: 999, background: C.accent, marginLeft: 'auto',
                  boxShadow: '0 0 10px rgba(16,185,129,.55)', animation: 'pulseDot 2s infinite',
                }} />
              </div>
              <div style={{ fontSize: 11, color: '#bfe0d3', marginBottom: 14 }}>Generado por el asistente · hoy 6:40 a.m.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {insights.map((it) => (
                  <div key={it.text} style={{ borderLeft: `2px solid ${C.accent}`, paddingLeft: 11 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{it.text}</div>
                    <a href={it.href ?? '#'} style={{
                      display: 'inline-block', fontFamily: C.cond, fontSize: 11, letterSpacing: '.1em',
                      textTransform: 'uppercase', color: C.accentLight, marginTop: 6, textDecoration: 'none',
                    }}>{it.action}</a>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={card}>
            <div style={{ ...cardTitle, padding: '16px 18px 10px' }}>REQUIERE ATENCIÓN</div>
            {alerts.map((a) => (
              <div key={a.title} style={{
                display: 'flex', gap: 11, padding: '12px 18px',
                borderTop: '1px solid rgba(150,225,196,.1)',
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: 999, marginTop: 6, flexShrink: 0,
                  background: LEVEL[a.level].color,
                }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{a.detail}</div>
                </div>
                <div style={{
                  marginLeft: 'auto', fontFamily: C.cond, fontSize: 18, fontWeight: 700,
                  color: LEVEL[a.level].color,
                }}>{a.count}</div>
              </div>
            ))}
          </div>

          <div style={{ ...card, padding: '16px 18px' }}>
            <div style={{ ...cardTitle, marginBottom: 12 }}>ACCIONES RÁPIDAS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['Nuevo estudiante', '/dashboard/estudiantes'],
                ['Nuevo comunicado', '/dashboard/comunicados'],
                ['Registrar asistencia', '/dashboard/asistencia'],
                ['Facturar mes', '/dashboard/tesoreria']].map(([l, href]) => (
                <a key={l} href={href} style={{
                  border: '1px solid rgba(150,225,196,.16)', borderRadius: 11, padding: 11,
                  background: C.chip, fontSize: 12.5, color: C.text, textDecoration: 'none',
                }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
