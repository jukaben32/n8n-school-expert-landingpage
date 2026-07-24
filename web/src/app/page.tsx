import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SchoolOS — Portal escolar",
  description: "La plataforma todo-en-uno para gestionar tu colegio: estudiantes, familias, comunicados, asistencia y pagos.",
};

const features = [
  { icon: "🎒", title: "Estudiantes y familias", text: "Un registro central de estudiantes, tutores y su historial de inscripción." },
  { icon: "📬", title: "Comunicados", text: "Avisos al instante para todas las familias, con prioridad y seguimiento de lectura." },
  { icon: "📅", title: "Asistencia", text: "Registro diario de asistencia por sección, con reportes automáticos." },
  { icon: "💳", title: "Pagos", text: "Facturación y cobros con visibilidad clara del estado de cada familia." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-accent/10 dark:from-slate-950 dark:via-slate-900 dark:to-primary-dark/20">
      <div className="max-w-5xl mx-auto px-4 py-20">

        {/* Logo / Branding */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-glow mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422A12.083 12.083 0 0121 13c0 4.418-3.582 8-8 8S5 17.418 5 13c0-.935.164-1.832.463-2.668L12 14z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            SchoolOS
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
            La plataforma todo-en-uno para gestionar tu colegio: estudiantes, familias, comunicados, asistencia y pagos.
          </p>

          <div className="flex items-center justify-center gap-3 mt-8">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-6 py-3 transition shadow-glow"
            >
              Ir al portal
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-soft"
            >
              <p className="text-3xl mb-3" aria-hidden="true">{f.icon}</p>
              <h2 className="font-bold text-slate-900 dark:text-white">{f.title}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
