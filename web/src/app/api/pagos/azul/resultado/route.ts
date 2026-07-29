import { NextRequest, NextResponse } from 'next/server'
import { processAzulResult } from '@/lib/payments/azul'

/**
 * Azul redirige el NAVEGADOR del cliente (GET, con los datos de la
 * transacción en el querystring) a esta URL tanto para ApprovedUrl como
 * DeclinedUrl -- se distinguen por IsoCode/ResponseCode, no por la ruta.
 * CancelUrl apunta aquí también con ?cancelado=1 (Azul no agrega
 * parámetros en ese caso).
 *
 * Esta ruta es pública a propósito -- no depende de sesión de Next.js,
 * igual que el resto de los núcleos de esta app. La seguridad viene de
 * verificar el AuthHash de respuesta en processAzulResult(), no de la
 * sesión de quien hace el request.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const dashboardPagos = new URL('/dashboard/pagos', request.nextUrl.origin)

  if (params.get('cancelado') === '1') {
    dashboardPagos.searchParams.set('azul', 'cancelado')
    return NextResponse.redirect(dashboardPagos)
  }

  const orderNumber = params.get('OrderNumber')
  const authHash = params.get('AuthHash')

  if (!orderNumber || !authHash) {
    dashboardPagos.searchParams.set('azul', 'error')
    return NextResponse.redirect(dashboardPagos)
  }

  const outcome = await processAzulResult({
    orderNumber,
    amount: params.get('Amount') ?? '',
    authorizationCode: params.get('AuthorizationCode') ?? '',
    dateTime: params.get('DateTime') ?? '',
    responseCode: params.get('ResponseCode') ?? '',
    isoCode: params.get('IsoCode') ?? '',
    responseMessage: params.get('ResponseMessage') ?? '',
    errorDescription: params.get('ErrorDescription') ?? '',
    rrn: params.get('RRN') ?? '',
    azulOrderId: params.get('AzulOrderId') ?? '',
    authHash,
  })

  if (outcome.outcome === 'invalid') {
    console.error('[azul/resultado] Respuesta inválida:', outcome.reason)
    dashboardPagos.searchParams.set('azul', 'error')
  } else {
    dashboardPagos.searchParams.set('azul', outcome.outcome === 'approved' ? 'aprobado' : 'declinado')
  }

  return NextResponse.redirect(dashboardPagos)
}
