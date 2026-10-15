/**
 * Texto del aviso por correo. A propósito NO lleva ningún monto ni dato
 * salarial: solo avisa que el comprobante está disponible y manda a
 * iniciar sesión (los datos de sueldo nunca viajan por correo).
 */
export function composePayslipEmail(input: {
  firstName: string
  label: string // ej. "Octubre 2026 · 1ª quincena" (lo arma periodLabel)
  schoolName: string | null
  siteUrl: string
}): { subject: string; body: string } {
  const label = input.label
  const school = input.schoolName?.trim() || 'el colegio'
  const link = `${input.siteUrl.replace(/\/$/, '')}/dashboard/mi-nomina`
  return {
    subject: `Tu comprobante de pago está disponible (${label})`,
    body: [
      `Hola ${input.firstName},`,
      '',
      `Ya está disponible tu comprobante de pago de ${label} en la plataforma de ${school}.`,
      '',
      `Para verlo, inicia sesión con tu cuenta y entra a "Mi nómina":`,
      link,
      '',
      'Por tu seguridad, este correo no incluye montos. No compartas tu contraseña.',
      'Si no puedes entrar o algo no te cuadra, responde a Dirección o a Secretaría.',
    ].join('\n'),
  }
}
