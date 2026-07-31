import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Tus datos son tuyos — MentorIApp',
  description: 'Cómo protegemos y separamos los datos de cada colegio afiliado a MentorIApp.',
}

const commitments = [
  {
    title: 'Aislamiento real, no solo de pantalla',
    text: 'Los datos de tu colegio nunca se mezclan con los de otro. Esta separación vive en las reglas de la base de datos (Row Level Security), no solo en lo que la interfaz decide mostrar — así que ni un error de programación en otra parte del sistema puede filtrar tu información a otro colegio.',
  },
  {
    title: 'Exportación sin pedir permiso',
    text: 'Desde Configuración del colegio, cualquier director puede descargar toda la información de su colegio en un archivo, en cualquier momento, sin abrir un ticket de soporte ni esperar respuesta de nadie.',
  },
  {
    title: 'Puedes irte cuando quieras',
    text: 'Si decides dejar de usar MentorIApp, puedes exportar todo primero y luego pedir la eliminación completa de los datos de tu colegio. No hay período de permanencia forzado ni penalidad por salir.',
  },
  {
    title: 'Acceso solo para quien tú autorices',
    text: 'Solo las personas que tú invitas explícitamente (desde Personal, con el rol que tú elijas) pueden ver los datos de tu colegio. El equipo de MentorIApp no entra a revisar la información de un colegio salvo que tú lo pidas para soporte.',
  },
]

export default function TerminosPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-accent/10 dark:from-slate-950 dark:via-slate-900 dark:to-primary-dark/20 px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary dark:text-accent-light mb-3">
          Garantías de datos
        </p>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          Tus datos son tuyos.
        </h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400 leading-relaxed">
          Cada colegio afiliado a MentorIApp comparte la misma plataforma, pero eso no significa
          compartir datos. Esto es lo que garantizamos, en lenguaje simple, sin letra pequeña:
        </p>

        <div className="mt-10 space-y-6">
          {commitments.map((c) => (
            <div key={c.title} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <h2 className="font-bold text-slate-900 dark:text-white mb-2">{c.title}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-5">
          <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
            <strong>Nota:</strong> este texto describe cómo funciona la plataforma hoy, en
            lenguaje llano. No reemplaza un contrato o términos de servicio revisados por un
            abogado — si tu colegio necesita ese documento formal, contáctanos para coordinarlo.
          </p>
        </div>

        <div className="mt-10 text-center">
          <Link href="/" className="text-sm font-semibold text-primary dark:text-accent-light hover:underline">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  )
}
