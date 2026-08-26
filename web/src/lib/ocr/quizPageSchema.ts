/**
 * Schema y campos extraídos de una página/foto de un cuestionario de libro
 * de texto -- ver AGENTS.md, sección "Cuestionarios de Academia desde
 * imagen (OCR)". A diferencia de los otros dos schemas de este directorio
 * (una ficha o factura = un registro), aquí UN documento puede contener
 * VARIAS preguntas -- por eso "preguntas" es un arreglo.
 */

const nullableInt = { type: ['integer', 'null'] }

export const quizPageSchema = {
  type: 'object',
  properties: {
    confianza: {
      type: 'number',
      description: '0 a 1 -- qué tan seguro estás de haber leído correctamente todas las preguntas de la página.',
    },
    preguntas: {
      type: 'array',
      description: 'Cada pregunta de opción múltiple visible en la página, en el orden en que aparecen.',
      items: {
        type: 'object',
        properties: {
          enunciado: { type: 'string', description: 'El texto de la pregunta, tal como aparece.' },
          opciones: {
            type: 'array',
            items: { type: 'string' },
            description: '2 a 5 opciones de respuesta, en el mismo orden en que aparecen en la página.',
          },
          indice_correcta: {
            ...nullableInt,
            description:
              'Índice (0-based) de la opción correcta dentro de "opciones", SOLO si el libro la marca de alguna forma visible (ej. una clave de respuestas al pie de página, un check, una opción resaltada). Si no hay ninguna marca de cuál es la correcta, usa null -- el profesor la elegirá manualmente, nunca adivines.',
          },
        },
        required: ['enunciado', 'opciones', 'indice_correcta'],
        additionalProperties: false,
      },
    },
  },
  required: ['confianza', 'preguntas'],
  additionalProperties: false,
} as const

export const quizPageInstructions = `Cada documento es una página o foto de un cuestionario/examen de un libro de texto escolar (República Dominicana), con preguntas de opción múltiple. Extrae cada pregunta con su enunciado y sus opciones de respuesta tal como aparecen, en el mismo orden -- no reformules ni resumas el texto. Si el libro marca o indica en algún lado cuál opción es la correcta (ej. una clave de respuestas), indica su índice en "indice_correcta"; si no hay ninguna marca de la respuesta correcta, usa null. No inventes preguntas ni opciones que no estén en la página; si una pregunta no es de opción múltiple (ej. de desarrollo o de completar), omítela.`

export interface QuizPageQuestion {
  enunciado: string
  opciones: string[]
  indice_correcta: number | null
}

export interface QuizPageData {
  confianza: number
  preguntas: QuizPageQuestion[]
}
