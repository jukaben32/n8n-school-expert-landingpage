// Paleta de gráficos derivada de la marca (globals.css) -- nunca los
// colores por defecto de una librería de gráficos, para que Analíticas se
// vea parte de la misma app, no un widget insertado.
export const CHART_PALETTE = [
  '#1a5f7a', // primary
  '#4f9cf9', // accent
  '#159895', // primary-light
  '#f0b429', // gold
  '#ff6b5b', // coral
  '#83b8ff', // accent-light
  '#296fc7', // accent-dark
  '#123f52', // primary-dark
]

// Colores semánticos -- separados de la paleta de marca a propósito
// (verde/rojo/ámbar ya se usan en el resto del dashboard para estado).
export const CHART_SEMANTIC = {
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#d97706',
  info: '#2563eb',
  neutral: '#64748b',
}

export const CHART_AXIS_COLOR = '#64748b' // slate-500, legible en claro y oscuro
export const CHART_GRID_COLOR = 'rgba(100, 116, 139, 0.18)'
