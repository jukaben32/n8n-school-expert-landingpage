/**
 * Schema y campos extraídos de una ficha física de inscripción escaneada.
 * Ver AGENTS.md, sección "Fichas de inscripción de estudiantes (OCR)".
 */

const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] }

export const GUARDIAN_RELATIONSHIPS = ['madre', 'padre', 'tutor_legal', 'otro'] as const
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number]

export const enrollmentFormSchema = {
  type: 'object',
  properties: {
    confianza: {
      type: 'number',
      description: '0 a 1 -- qué tan seguro estás de haber leído correctamente la ficha completa.',
    },
    estudiante: {
      type: 'object',
      properties: {
        nombre: nullableString,
        apellido: nullableString,
        fecha_nacimiento: { ...nullableString, description: 'Formato YYYY-MM-DD si se puede inferir con certeza; si no, null.' },
        lugar_nacimiento: nullableString,
        curso: { ...nullableString, description: 'Grado o curso escolar escrito en la ficha.' },
        matricula: { ...nullableString, description: 'Número de matrícula escrito en la ficha, si tiene uno.' },
        historial_salud: { ...nullableString, description: 'Texto libre de alergias, condiciones médicas u otra información de salud anotada en la ficha.' },
      },
      required: ['nombre', 'apellido', 'fecha_nacimiento', 'lugar_nacimiento', 'curso', 'matricula', 'historial_salud'],
      additionalProperties: false,
    },
    tutores: {
      type: 'array',
      description: 'Madre, padre y/o tutor legal anotados en la ficha -- normalmente 1 a 2, a veces más.',
      items: {
        type: 'object',
        properties: {
          parentesco: { type: 'string', enum: GUARDIAN_RELATIONSHIPS as unknown as string[] },
          nombre: nullableString,
          apellido: nullableString,
          cedula: nullableString,
          direccion: nullableString,
          telefono: nullableString,
          provincia_origen: nullableString,
          nacionalidad: nullableString,
          ocupacion: nullableString,
          lugar_trabajo: nullableString,
        },
        required: ['parentesco', 'nombre', 'apellido', 'cedula', 'direccion', 'telefono', 'provincia_origen', 'nacionalidad', 'ocupacion', 'lugar_trabajo'],
        additionalProperties: false,
      },
    },
    contacto_emergencia: {
      type: 'object',
      properties: {
        nombre: nullableString,
        telefono: nullableString,
        parentesco: nullableString,
      },
      required: ['nombre', 'telefono', 'parentesco'],
      additionalProperties: false,
    },
  },
  required: ['confianza', 'estudiante', 'tutores', 'contacto_emergencia'],
  additionalProperties: false,
} as const

export const enrollmentFormInstructions = `Cada documento es UNA ficha física de inscripción escolar (República Dominicana), llenada a mano, con estos bloques:
1. Datos del estudiante: nombre, apellido, fecha de nacimiento, lugar de nacimiento, curso/grado, número de matrícula.
2. Historial de salud del estudiante (alergias, condiciones, etc. -- texto libre anotado a mano).
3. Datos de madre, padre y/o tutor legal: nombre, cédula, dirección, teléfono, provincia de origen, nacionalidad, ocupación, lugar de trabajo. Incluye un objeto en "tutores" por cada persona que aparezca con datos propios (no dupliques si un campo faltante hace que dos personas se vean iguales).
4. Contacto de emergencia (nombre, teléfono, parentesco con el estudiante) -- puede ser el mismo tutor o una persona distinta.

La letra es manuscrita y puede ser difícil de leer. No inventes cédulas, teléfonos ni nombres que no puedas leer con razonable certeza.`

export interface EnrollmentFormGuardian {
  parentesco: GuardianRelationship
  nombre: string | null
  apellido: string | null
  cedula: string | null
  direccion: string | null
  telefono: string | null
  provincia_origen: string | null
  nacionalidad: string | null
  ocupacion: string | null
  lugar_trabajo: string | null
}

export interface EnrollmentFormData {
  confianza: number
  estudiante: {
    nombre: string | null
    apellido: string | null
    fecha_nacimiento: string | null
    lugar_nacimiento: string | null
    curso: string | null
    matricula: string | null
    historial_salud: string | null
  }
  tutores: EnrollmentFormGuardian[]
  contacto_emergencia: {
    nombre: string | null
    telefono: string | null
    parentesco: string | null
  }
}
