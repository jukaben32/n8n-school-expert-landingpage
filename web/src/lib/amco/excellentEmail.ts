// Correo con el acceso de cada familia a Excellent (plataforma de exámenes de
// inglés de Amco). Puro a propósito (sin Supabase ni Next.js): así se puede
// probar el texto exacto que va a recibir cada familia.
//
// El texto sale del comunicado de la Coordinación del Área de Inglés
// (María Angélica Vizcaíno, 13 y 14 de octubre de 2026), unificado en uno
// solo sin cambiar su estilo. Los originales están en
// docs/AMCO_EXCELLENT_2026-2027.md.

export const EXCELLENT_URL = 'https://app.eecertification.com/'
export const EXCELLENT_TUTORIAL_URL = 'https://youtu.be/qNFdgJy3NH4?feature=shared'
export const EXCELLENT_SCHOOL_SITE_URL = 'https://www.educacionmanantial.com/colegio/gran-manantial-de-sabiduria'
export const EXCELLENT_PASSWORD = '12345678'
export const EXCELLENT_SCHOOL_YEAR = '2026-2027'

export interface ExcellentChild {
  fullName: string
  grade: string
  amcoEmail: string
}

export function buildExcellentAccessEmail(children: ExcellentChild[]): { subject: string; body: string } {
  const plural = children.length > 1
  const accountLines = children
    .map((c) => `• ${c.fullName} (${c.grade}): ${c.amcoEmail}`)
    .join('\n')

  const body = [
    '📣 COMUNICADO A LOS PADRES, MADRES Y TUTORES',
    '',
    'Reciban un cordial saludo.',
    '',
    'Les compartimos las instrucciones para acceder a la plataforma Excellent, donde nuestros estudiantes realizarán sus exámenes de inglés. Cada estudiante tiene un correo de Amco propio, con vigencia durante todo el período escolar ' + EXCELLENT_SCHOOL_YEAR + '.',
    '',
    plural ? '📧 Correos de Amco de sus hijos:' : '📧 Correo de Amco de su hijo(a):',
    accountLines,
    '',
    '🔐 Datos de acceso:',
    plural
      ? '* Usuario: Correo de Amco de cada estudiante (el que aparece arriba).'
      : '* Usuario: Correo de Amco del estudiante (el que aparece arriba).',
    `* Contraseña: ${EXCELLENT_PASSWORD} (del 1 al 8).`,
    '',
    `🔗 Enlace: ${EXCELLENT_URL}`,
    `Además, desde el sitio web del colegio pueden entrar a Amco y conocer más de nuestros programas y servicios: ${EXCELLENT_SCHOOL_SITE_URL}`,
    '',
    '📱 Importante: Deben descargar la aplicación en un teléfono o tableta compatible para realizar los exámenes.',
    '',
    `🎥 Video con el paso a paso para entrar a la plataforma: ${EXCELLENT_TUTORIAL_URL}`,
    '',
    '✅ Por favor, ingresen a la plataforma y verifiquen que puedan acceder correctamente.',
    '',
    plural
      ? '🤝 Los estudiantes deben tomar una evaluación del período, y les pedimos darles en casa el apoyo que necesiten para realizarla.'
      : '🤝 El estudiante debe tomar una evaluación del período, y les pedimos darle en casa el apoyo que necesite para realizarla.',
    '',
    '⚠️ Atención: Les informaremos por esta misma vía cuándo podrán comenzar a realizar los exámenes. Favor esperar nuestra autorización antes de iniciarlos.',
    '',
    'Agradecemos su colaboración y apoyo.',
    '',
    'Coordinación del Área de Inglés',
    'Centro Gran Manantial de Sabiduría (CEGMAS)',
  ].join('\n')

  return { subject: 'Acceso a Excellent: exámenes de inglés (Amco)', body }
}

/**
 * Texto para el documento de preguntas frecuentes del asistente de IA
 * (`schools.faq_document`). Sin datos de ningún estudiante: el correo de cada
 * hijo se le da al asistente aparte, filtrado por familia.
 */
export const EXCELLENT_FAQ_SECTION = `EXÁMENES DE INGLÉS EN LA PLATAFORMA EXCELLENT (AMCO) — PERÍODO ${EXCELLENT_SCHOOL_YEAR}
Los exámenes de inglés se hacen en Excellent, la plataforma de trabajo de Amco para los estudiantes. Lo coordina la Coordinación del Área de Inglés del colegio.
- Quiénes: por ahora, de 3ro de Primaria a 6to de Secundaria. 1ro y 2do de Primaria e Inicial se confirmarán después; si el padre pregunta por ellos, decir que todavía no hay confirmación y que se avisará por correo.
- Enlace de la plataforma: ${EXCELLENT_URL}
- El sitio web del colegio (${EXCELLENT_SCHOOL_SITE_URL}) tiene el enlace a Amco, y ahí también pueden conocer más de los programas y servicios del colegio.
- Hay que descargar la aplicación de Excellent en un teléfono o tableta compatible: los exámenes se hacen en la aplicación.
- Usuario: el correo de Amco del estudiante (cada estudiante tiene el suyo, con vigencia durante todo el período escolar ${EXCELLENT_SCHOOL_YEAR}). El asistente puede darle a la familia el correo de Amco de SUS hijos si aparece en los datos de la familia; nunca el de otros estudiantes.
- Contraseña: ${EXCELLENT_PASSWORD} (del 1 al 8), igual para todos.
- Video con el paso a paso para entrar: ${EXCELLENT_TUTORIAL_URL}
- Los estudiantes deben tomar una evaluación del período. Los padres deben darles en casa el apoyo que necesiten para hacerla.
- Antes de que lleguen los exámenes se pide entrar a la plataforma y comprobar que el acceso funciona.
- Fecha de los exámenes: todavía no está definida. La Coordinación del Área de Inglés avisará por correo cuándo comenzar; los estudiantes deben esperar esa autorización antes de iniciar cualquier examen. Si el padre pregunta la fecha, decir exactamente eso; no inventar fechas.
- Si el correo de Amco de un hijo no aparece en los datos de la familia, o la contraseña no funciona, o la aplicación da problemas: dejar aviso a la secretaría con el nombre del estudiante y qué ocurre (la Coordinación de Inglés lo resuelve con Amco). No prometer soluciones de la plataforma de Amco.`
