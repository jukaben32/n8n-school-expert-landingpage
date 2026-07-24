const nodes = [
  { label: 'Dirección ve', text: '"3 pagos vencidos este mes"', tone: 'text-accent-light' },
  { label: 'Secretaría hace', text: '"Enviar recordatorio a 3 familias"', tone: 'text-gold' },
  { label: 'Familia recibe', text: '"Tu mensualidad está pendiente"', tone: 'text-coral' },
]

/**
 * EventCascade — la firma visual de la landing.
 * Un mismo evento (una factura vencida) cambia de forma según el rol
 * que lo ve: esto es, literalmente, lo que construimos esta sesión
 * (roles + RLS por colegio), no una metáfora vacía.
 */
export default function EventCascade() {
  return (
    <div className="relative">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-0 relative">
        {nodes.map((node, i) => (
          <div key={node.label} className="relative flex flex-col items-center text-center px-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-white/40">{node.label}</span>
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 w-full min-h-[76px] flex items-center justify-center">
              <p className={`text-sm font-medium ${node.tone}`}>{node.text}</p>
            </div>

            {/* Línea + punto viajero hacia el siguiente nodo (solo desktop, no en el último) */}
            {i < nodes.length - 1 && (
              <div className="hidden sm:block absolute top-[34px] left-1/2 w-full h-px bg-white/15 z-0">
                <span
                  className="animate-travel absolute -top-[3px] w-2 h-2 rounded-full bg-accent shadow-[0_0_12px_2px_var(--accent)]"
                  style={{ animationDelay: `${i * 0.9}s` }}
                  aria-hidden="true"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
