/**
 * Etiquetas en español de los ROLES DE ACCESO (`users_profiles.role`) --
 * distintos del PUESTO de la ficha de personal (`staff.role`, ver
 * `lib/staff/roleLabels.ts`).
 *
 * Vive en un módulo plano a propósito. Antes este mapa se exportaba desde
 * `dashboard/personal/ChangeAccessRoleButton.tsx`, que lleva `'use client'`
 * arriba: cuando un Server Component importa un valor de un módulo de
 * cliente, el bundler le entrega una referencia de cliente y no el objeto
 * real, así que `accessRoleLabels['teacher']` quedaba `undefined` y la
 * ficha de Personal mostraba "Acceso: teacher" en inglés crudo en vez de
 * "Docente" (visible en producción el 2026-09-15). Es el mismo patrón que
 * ya tumbó Cuentas por Cobrar entera el 2026-09-03 con
 * EXTERNAL_PAYMENT_SOURCES, pero cruzando la frontera contraria.
 *
 * REGLA: ninguna constante compartida entre servidor y cliente vive en un
 * archivo con `'use client'` ni con `'use server'`.
 */

/** Roles que se pueden ASIGNAR desde Personal (los de trabajo). */
export const assignableAccessRoles = [
  { value: 'director', label: 'Director' },
  { value: 'school_admin', label: 'Administrador de colegio' },
  { value: 'teacher', label: 'Docente' },
  { value: 'finance', label: 'Finanzas' },
  { value: 'reception', label: 'Recepción' },
] as const

/**
 * Todos los roles posibles, para poder MOSTRAR cualquiera sin caer en el
 * valor crudo en inglés -- incluidos los que no se asignan desde Personal.
 */
export const accessRoleLabels: Record<string, string> = {
  ...Object.fromEntries(assignableAccessRoles.map((r) => [r.value, r.label])),
  super_admin: 'Súper administrador',
  guardian: 'Tutor (solo Portal Familiar)',
  student: 'Estudiante',
}
