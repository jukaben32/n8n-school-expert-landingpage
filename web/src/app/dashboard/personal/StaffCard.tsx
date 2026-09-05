'use client'

import { useState } from 'react'

/**
 * Una persona en la lista de Personal: fila compacta (lo que se necesita
 * para "ver el listado de empleados y ya") con el resto plegado detrás de
 * un clic.
 *
 * Antes cada empleado ocupaba una tarjeta con CINCO bloques abiertos a la
 * vez -- identidad, editar/eliminar, acceso al sistema, asignación de
 * grados y formación académica -- y con 30 empleados la pantalla dejaba de
 * servir para lo más básico, que es consultar quién trabaja aquí y cómo
 * contactarlo (pedido del usuario, 2026-09-04).
 *
 * `acciones` y `detalle` llegan como slots ya renderizados desde el
 * servidor: los botones de editar/eliminar/acceso y el asignador de grados
 * siguen siendo exactamente los mismos componentes, con los mismos props.
 * Aquí solo se decide qué se ve y qué se pliega -- no se toca ningún dato,
 * permiso ni acción.
 */
export default function StaffCard({
  nombre,
  puesto,
  email,
  phone,
  desde,
  tieneAcceso,
  accesoLabel,
  acciones,
  detalle,
}: {
  nombre: string
  puesto: string
  email: string
  phone: string | null
  desde: string
  tieneAcceso: boolean
  accesoLabel: string | null
  acciones: React.ReactNode
  detalle: React.ReactNode
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="dash-card px-4 py-3 print:border print:border-slate-300 print:rounded-none print:shadow-none">
      {/* Fila compacta -- al imprimir queda como una línea de listado */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="flex flex-1 items-center gap-3 text-left min-w-0 print:cursor-default"
        >
          <svg
            className={`w-4 h-4 shrink-0 transition-transform print:hidden ${abierto ? 'rotate-90' : ''}`}
            style={{ color: 'var(--dash-text-faint)' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold truncate" style={{ color: 'var(--dash-text)' }}>{nombre}</p>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold font-barlow uppercase tracking-wider"
                style={{ background: 'rgba(74,222,159,.15)', color: 'var(--dash-accent)' }}
              >
                {puesto}
              </span>
              {!tieneAcceso && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-barlow uppercase tracking-wider bg-amber-100 text-amber-700">
                  sin acceso
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--dash-text-muted)' }}>
              {phone ? `${phone} · ` : ''}{email}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-3 shrink-0 print:hidden">
          {acciones}
        </div>
      </div>

      {/* Ficha completa -- plegada por defecto */}
      {abierto && (
        <div className="mt-3 pt-3 border-t print:hidden" style={{ borderColor: 'rgba(150,225,196,.14)' }}>
          <p className="text-xs mb-3" style={{ color: 'var(--dash-text-faint)' }}>
            En el colegio desde {desde}
            {accesoLabel ? ` · Acceso: ${accesoLabel}` : ''}
          </p>
          {detalle}
        </div>
      )}
    </div>
  )
}
