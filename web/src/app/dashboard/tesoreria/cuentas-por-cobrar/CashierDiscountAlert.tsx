import Link from 'next/link'

export interface CashierDiscountMismatch {
  studentId: string
  studentName: string
  /** % que caja aplicó en Alegra en su último cobro con descuento. */
  cashierPercent: number
  /** Beca en % registrada en la plataforma (null = ninguna). */
  platformPercent: number | null
  lastDate: string
}

/**
 * Aviso para Dirección: estudiantes a los que caja les cobra la mensualidad
 * con descuento en Alegra y que en la plataforma no tienen esa beca (o tienen
 * otra). Sin la beca registrada, al padre le aparece como deuda la parte que
 * caja descontó (reporte del colegio, 2026-11-25). La beca la decide una
 * persona en la ficha del estudiante; este aviso no cambia nada solo.
 */
export default function CashierDiscountAlert({ items }: { items: CashierDiscountMismatch[] }) {
  if (items.length === 0) return null
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-slate-800 space-y-2">
      <h2 className="text-sm font-bold text-amber-900">
        ⚠️ Caja cobra con descuento a {items.length} {items.length === 1 ? 'estudiante' : 'estudiantes'} sin esa beca en la plataforma
      </h2>
      <p className="text-xs text-amber-900/80">
        Mientras no se registre la beca, la plataforma le cobra la cuota completa y al padre le aparece como deuda lo
        que caja descontó (con recargo y, a los 61 días, bloqueo). Si el descuento es correcto, Dirección lo carga en la
        ficha del estudiante → Mensualidad → Asignar beca. Si no lo es, hay que corregir el cobro en Alegra.
      </p>
      <ul className="text-sm divide-y divide-amber-200">
        {items.map((it) => (
          <li key={it.studentId} className="py-1.5 flex flex-wrap items-center justify-between gap-2">
            <Link href={`/dashboard/estudiantes/${it.studentId}`} className="font-semibold text-primary hover:underline">
              {it.studentName}
            </Link>
            <span className="text-xs text-slate-700">
              Caja: <strong>{it.cashierPercent}%</strong> · Plataforma:{' '}
              <strong>{it.platformPercent != null ? `${it.platformPercent}%` : 'sin beca'}</strong> · último cobro{' '}
              {new Date(`${it.lastDate.slice(0, 10)}T12:00:00`).toLocaleDateString('es-DO')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
