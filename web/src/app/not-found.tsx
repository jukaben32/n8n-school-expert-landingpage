import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-white to-accent/10 dark:from-slate-950 dark:via-slate-900 dark:to-primary-dark/20 px-4">
      <div className="max-w-md text-center space-y-4">
        <p className="text-5xl font-black text-primary dark:text-accent-light">404</p>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">
          Página no encontrada
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          La página que buscas no existe o fue movida.
        </p>
        <Link
          href="/"
          className="inline-block rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-6 py-2.5 transition shadow-glow"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
