import Link from 'next/link'

/**
 * "Última actualización" de la conciliación con Alegra.
 *
 * Existe porque sin esto la pantalla de Cuentas por Cobrar no puede decir
 * con honestidad si los números que muestra ya incluyen lo cobrado hoy en
 * el POS. Un reporte de deuda sin fecha de corte invita a cobrarle a una
 * familia que ya pagó -- que es exactamente el problema que originó todo
 * este trabajo.
 *
 * Muestra el estado real, incluido el feo: si la última corrida falló, o
 * si nunca ha corrido, lo dice en vez de quedarse callado.
 */

export interface AlegraSyncRun {
  started_at: string
  finished_at: string | null
  status: 'ok' | 'error' | 'sin_credenciales'
  invoices_seen: number
  loaded_count: number
  loaded_amount: number
  review_count: number
  error_message: string | null
}

const formatDOP = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' })

function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString('es-DO', {
    timeZone: 'America/Santo_Domingo',
    day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export default function AlegraSyncBanner({ run, pendingReview }: { run: AlegraSyncRun | null; pendingReview: number }) {
  const reviewLink = pendingReview > 0 ? (
    <Link
      href="/dashboard/tesoreria/alegra"
      className="font-semibold underline underline-offset-2 hover:no-underline"
    >
      Revisar {pendingReview} {pendingReview === 1 ? 'cobro' : 'cobros'}
    </Link>
  ) : (
    <Link href="/dashboard/tesoreria/alegra" className="underline underline-offset-2 hover:no-underline">
      Ver conciliación
    </Link>
  )

  if (!run) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span className="font-medium text-slate-800">Conciliación con Alegra:</span>{' '}
        todavía no ha corrido ninguna vez. Los cobros hechos en el POS podrían no estar reflejados aquí.{' '}
        {reviewLink}
      </div>
    )
  }

  const moment = formatMoment(run.finished_at ?? run.started_at)

  if (run.status === 'error' || run.status === 'sin_credenciales') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <p>
          <span className="font-semibold">La última conciliación con Alegra no se completó</span> ({moment}).
          Estos números pueden mostrar como deuda dinero que ya se cobró en el POS.
        </p>
        {run.error_message && (
          <p className="mt-1 text-xs text-red-700 break-words">{run.error_message}</p>
        )}
        <p className="mt-1">{reviewLink}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <span className="font-semibold">Cobros de Alegra al día:</span>{' '}
      última actualización {moment}
      {run.loaded_count > 0 ? (
        <> · se registraron {run.loaded_count} {run.loaded_count === 1 ? 'cobro' : 'cobros'} por {formatDOP.format(run.loaded_amount)}</>
      ) : (
        <> · sin cobros nuevos</>
      )}
      {pendingReview > 0 && (
        <> · <span className="font-semibold text-amber-800">{pendingReview} {pendingReview === 1 ? 'necesita' : 'necesitan'} revisión</span></>
      )}
      {' '}· {reviewLink}
    </div>
  )
}
