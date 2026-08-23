// Paleta de gráficos derivada de la marca oscura/menta del dashboard
// (globals.css, --dash-*) -- nunca los colores por defecto de una
// librería de gráficos, para que Analíticas se vea parte de la misma
// app, no un widget insertado.
export const CHART_PALETTE = [
  '#4ade9f', // dash-accent
  '#6ee7b7', // dash-accent-light
  '#10b981', // emerald-500
  '#16c78f',
  '#0b8259', // dash-accent-dark
  '#e6bd63', // dash-warning
  '#e08a7e', // dash-danger
  '#9dbfb2', // sage muted
]

// Colores semánticos -- separados de la paleta de marca a propósito
// (verde/rojo/ámbar ya se usan en el resto del dashboard para estado).
export const CHART_SEMANTIC = {
  success: '#4ade9f',
  danger: '#ff9d90',
  warning: '#e6bd63',
  info: '#6ee7b7',
  neutral: '#5f7a70',
}

export const CHART_AXIS_COLOR = '#93b6a9' // dash-text-muted, legible sobre las tarjetas oscuras
export const CHART_GRID_COLOR = 'rgba(150, 225, 196, 0.14)'
