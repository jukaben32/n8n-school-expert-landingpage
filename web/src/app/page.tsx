import Link from 'next/link'
import type { Metadata } from 'next'
import EventCascade from './EventCascade'
import LeadForm from './LeadForm'

export const metadata: Metadata = {
  title: 'MentorIApp — El colegio, ordenado. La familia, tranquila.',
  description:
    'Plataforma para redes y colegios afiliados: estudiantes, familias, tesorería, comunicados, asistencia y una Academia con video-lecciones y cuestionarios. Un sistema real, con un panel distinto para cada rol.',
}

const audiences = [
  {
    tag: 'Dirección',
    title: 'Ver el colegio entero, sin llamar a nadie',
    points: [
      'Métricas del colegio en un panel: estudiantes, familias, comunicados, cobros.',
      'Ficha profesional de cada docente: título, especialidad, certificaciones.',
      'Reportes de asistencia y cobros de los últimos 30 días, listos para revisar.',
    ],
  },
  {
    tag: 'Secretaría',
    title: 'Menos llamadas repetidas, más hecho',
    points: [
      'Alta de estudiantes y familias en un solo formulario, sin duplicar datos.',
      'Comunicados con confirmación de lectura: se sabe quién ya lo vio.',
      'Registro de asistencia diario, por sección, en segundos.',
    ],
  },
  {
    tag: 'Familias',
    title: 'Un solo lugar para lo que importa',
    points: [
      'Estado de cuenta claro: qué se debe, qué ya se pagó, y desde cuándo.',
      'Comunicados del colegio, sin perderse entre grupos de chat.',
      'Sus hijos aprendiendo en Academia, con seguimiento real de su progreso.',
    ],
  },
]

const modules = [
  { icon: '🎒', name: 'Estudiantes y familias', text: 'Un registro central por colegio, con historial de inscripción.' },
  { icon: '🧑‍🏫', name: 'Personal', text: 'Ficha profesional de cada docente: título, egresado de, especialidad.' },
  { icon: '💳', name: 'Tesorería', text: 'Factura con NCF automático, cobros y estado de cuenta por familia.' },
  { icon: '📬', name: 'Comunicados', text: 'Avisos con prioridad y confirmación de lectura por familia.' },
  { icon: '📅', name: 'Asistencia', text: 'Registro diario por sección, con historial consultable.' },
  { icon: '🎓', name: 'Academia', text: 'Video-lecciones con cuestionario, puntos, racha e insignias.' },
  { icon: '📊', name: 'Reportes', text: 'Asistencia, cobros e inscripción de los últimos 30 días.' },
  { icon: '🏫', name: 'Plataforma multi-colegio', text: 'Una cuenta que ve y gestiona todos los colegios afiliados.' },
]

const steps = [
  { label: 'Solicitas la demo', text: 'Nos cuentas el tamaño de tu colegio y qué te urge más. Te respondemos en menos de 24 horas.' },
  { label: 'Configuramos tu colegio', text: 'Cargamos tus grados, materias y roles del personal. Tu colegio queda aislado del resto: nadie más ve tus datos.' },
  { label: 'Tu equipo y familias entran', text: 'Cada quien inicia sesión con su cuenta y ve exactamente el panel que le corresponde a su rol.' },
]

const results = [
  { stat: '1 panel', label: 'por rol', text: 'Dirección, secretaría, docentes y familias ven cada uno lo suyo — sin permisos mal puestos.' },
  { stat: 'NCF', label: 'automático', text: 'Cada factura sale con su comprobante fiscal generado por el sistema, no a mano.' },
  { stat: 'Lectura', label: 'confirmada', text: 'Un comunicado deja de ser un mensaje en el vacío: se sabe quién lo vio y quién no.' },
  { stat: '0', label: 'colegios cruzados', text: 'La seguridad vive en la base de datos, no solo en la pantalla: un colegio nunca ve a otro.' },
]

const faqs = [
  {
    q: '¿Las familias necesitan instalar algo?',
    a: 'No. MentorIApp es una aplicación web: se entra desde el navegador del celular o la computadora, con su correo y contraseña, sin descargar nada.',
  },
  {
    q: '¿Cómo se enteran las familias de un comunicado nuevo?',
    a: 'Lo ven en su Portal Familiar apenas inician sesión, con prioridad marcada si es urgente. El aviso por correo automático está en camino — hoy el canal confirmado es el portal.',
  },
  {
    q: '¿Qué tan seguro es que un colegio vea los datos de otro?',
    a: 'No puede pasar: la separación entre colegios está en las reglas de la base de datos (RLS), no solo en la interfaz. Aunque alguien intentara saltarse la pantalla, la base de datos igual se lo impide.',
  },
  {
    q: '¿Cuánto toma tener el colegio funcionando?',
    a: 'Después de la demo, configurar grados, materias y las cuentas del personal toma típicamente unos días, no meses — el sistema ya existe y funciona, no se construye desde cero para tu colegio.',
  },
  {
    q: '¿Qué es Academia exactamente?',
    a: 'Un video de una lección seguido de un cuestionario corto con retroalimentación al instante. El estudiante gana puntos y racha; el docente ve quién entendió y quién necesita repaso.',
  },
]

export default function Home() {
  return (
    <div className="bg-ink">

      {/* ============ NAV ============ */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/90 backdrop-blur">
        <nav className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="#inicio" className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-glow shrink-0">
              <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422A12.083 12.083 0 0121 13c0 4.418-3.582 8-8 8S5 17.418 5 13c0-.935.164-1.832.463-2.668L12 14z" />
              </svg>
            </span>
            <span className="font-display font-semibold text-lg text-white tracking-tight">MentorIApp</span>
          </a>
          <div className="hidden md:flex items-center gap-7 font-mono text-xs uppercase tracking-wider text-white/60">
            <a href="#modulos" className="hover:text-white transition">Módulos</a>
            <a href="#academia" className="hover:text-white transition">Academia</a>
            <a href="#como-funciona" className="hover:text-white transition">Cómo funciona</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:block text-sm font-medium text-white/70 hover:text-white transition">
              Ingresar
            </Link>
            <a href="#demo" className="rounded-full bg-coral hover:brightness-110 text-white text-sm font-semibold px-4 py-2 transition shadow-glow">
              Solicitar demo
            </a>
          </div>
        </nav>
      </header>

      {/* ============ HERO ============ */}
      <section id="inicio" className="relative overflow-hidden">
        {/* Resplandores ambientales */}
        <div className="pointer-events-none absolute -top-32 -left-32 w-[36rem] h-[36rem] bg-primary/25 rounded-full blur-[120px]" />
        <div className="pointer-events-none absolute top-40 -right-24 w-[28rem] h-[28rem] bg-coral/20 rounded-full blur-[110px]" />

        <div className="relative max-w-6xl mx-auto px-5 pt-20 pb-24">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent-light mb-5">
            Plataforma para redes y colegios afiliados
          </p>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[1.05] text-white max-w-3xl">
            El colegio, ordenado.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-light to-coral">La familia, tranquila.</span>
          </h1>
          <p className="mt-6 text-lg text-white/60 max-w-xl leading-relaxed">
            Un sistema real — no una propuesta — donde dirección, secretaría, docentes y familias entran a su
            propia cuenta y ven exactamente lo que les toca. Estudiantes, tesorería, comunicados, asistencia
            y una Academia con video-lecciones, todo en un mismo lugar.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a href="#demo" className="rounded-full bg-coral hover:brightness-110 text-white font-semibold px-7 py-3.5 text-sm transition shadow-glow">
              Solicitar demo para mi colegio
            </a>
            <Link href="/login" className="rounded-full border border-white/20 hover:border-white/40 text-white font-semibold px-7 py-3.5 text-sm transition">
              Ya somos parte — Ingresar
            </Link>
          </div>

          <div className="mt-16">
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/35 mb-4 text-center sm:text-left">
              Un mismo hecho, visto por cada rol
            </p>
            <EventCascade />
          </div>
        </div>
      </section>

      {/* ============ PARA QUIÉN ============ */}
      <section className="bg-paper text-ink">
        <div className="max-w-6xl mx-auto px-5 py-24">
          <p className="font-mono text-xs uppercase tracking-widest text-primary mb-3">Para quién</p>
          <h2 className="font-display text-3xl sm:text-4xl max-w-2xl leading-tight">
            Tres personas distintas, un mismo sistema — cada quien ve solo lo suyo.
          </h2>

          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {audiences.map((a) => (
              <div key={a.tag} className="rounded-2xl bg-white border border-black/5 p-7 shadow-soft">
                <span className="inline-block font-mono text-[11px] uppercase tracking-widest text-primary bg-primary/10 rounded-full px-3 py-1">
                  {a.tag}
                </span>
                <h3 className="font-display text-xl mt-4 mb-4 leading-snug">{a.title}</h3>
                <ul className="space-y-2.5">
                  {a.points.map((p) => (
                    <li key={p} className="text-sm text-ink/65 leading-relaxed pl-4 relative before:content-['—'] before:absolute before:left-0 before:text-primary/50">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ MÓDULOS ============ */}
      <section id="modulos" className="bg-ink">
        <div className="max-w-6xl mx-auto px-5 py-24">
          <p className="font-mono text-xs uppercase tracking-widest text-accent-light mb-3">Módulos del sistema</p>
          <h2 className="font-display text-3xl sm:text-4xl text-white max-w-2xl leading-tight">
            Ocho módulos que ya existen y funcionan — no en el mapa de ruta.
          </h2>

          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {modules.map((m) => (
              <div key={m.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.06] transition">
                <p className="text-3xl mb-3" aria-hidden="true">{m.icon}</p>
                <h3 className="font-semibold text-white text-sm mb-1.5">{m.name}</h3>
                <p className="text-xs text-white/50 leading-relaxed">{m.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ ACADEMIA SPOTLIGHT ============ */}
      <section id="academia" className="bg-paper text-ink">
        <div className="max-w-6xl mx-auto px-5 py-24 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-primary mb-3">La pieza distinta</p>
            <h2 className="font-display text-3xl sm:text-4xl leading-tight mb-5">
              Academia: video, cuestionario y una razón para volver mañana.
            </h2>
            <p className="text-ink/65 leading-relaxed mb-6">
              Cada lección tiene un video corto y un cuestionario de opción múltiple con respuesta al instante.
              El estudiante ve su puntaje, su racha de días seguidos y las insignias que va ganando. El docente
              ve, lección por lección, quién entendió y quién necesita repaso — sin adivinar.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <span className="font-mono text-xs bg-white border border-black/10 rounded-full px-3 py-1.5">🎬 Video-lección</span>
              <span className="font-mono text-xs bg-white border border-black/10 rounded-full px-3 py-1.5">✅ Feedback instantáneo</span>
              <span className="font-mono text-xs bg-white border border-black/10 rounded-full px-3 py-1.5">🔥 Racha diaria</span>
              <span className="font-mono text-xs bg-white border border-black/10 rounded-full px-3 py-1.5">🏅 Insignias</span>
            </div>
          </div>

          <div className="rounded-2xl bg-ink p-6 shadow-glow">
            <div className="flex items-center justify-between mb-5">
              <span className="font-mono text-[11px] uppercase tracking-widest text-white/40">Vista del estudiante</span>
              <span className="text-2xl" aria-hidden="true">🎓</span>
            </div>
            <div className="flex gap-6 mb-5">
              <div className="text-center">
                <p className="font-display text-2xl text-accent-light">240</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">Puntos</p>
              </div>
              <div className="text-center">
                <p className="font-display text-2xl text-gold">🔥 5</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">Racha</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {['Las fracciones', 'El ciclo del agua'].map((lesson, i) => (
                <div key={lesson} className="rounded-xl border border-white/10 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-white/80">{lesson}</span>
                  {i === 0 ? (
                    <span className="text-xs font-bold text-emerald-400">✓ 9/10</span>
                  ) : (
                    <span className="text-xs font-bold text-coral">Ver lección</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ PLATAFORMA MULTI-COLEGIO ============ */}
      <section className="bg-ink border-t border-white/10">
        <div className="max-w-6xl mx-auto px-5 py-24 grid lg:grid-cols-[1fr_1.1fr] gap-14 items-center">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 order-2 lg:order-1">
            {['Gran Manantial de Sabiduría', 'Colegio San Rafael', 'Instituto Las Américas'].map((school, i) => (
              <div key={school} className={`flex items-center justify-between py-3.5 ${i > 0 ? 'border-t border-white/10' : ''}`}>
                <span className="text-sm text-white/80">{school}</span>
                <span className="font-mono text-[11px] text-accent-light border border-accent/30 rounded-full px-2.5 py-1">
                  Entrar como director
                </span>
              </div>
            ))}
          </div>
          <div className="order-1 lg:order-2">
            <p className="font-mono text-xs uppercase tracking-widest text-accent-light mb-3">Para redes de colegios</p>
            <h2 className="font-display text-3xl sm:text-4xl text-white leading-tight mb-5">
              Una cuenta para ver todos tus colegios afiliados — sin mezclarlos jamás.
            </h2>
            <p className="text-white/60 leading-relaxed">
              Desde Plataforma, el súper administrador ve cada colegio afiliado con su cantidad de estudiantes
              y personal, y puede entrar a cualquiera como si fuera su propio director. Cada colegio sigue
              completamente aislado del resto: la regla vive en la base de datos, no en la buena voluntad
              de nadie.
            </p>
          </div>
        </div>
      </section>

      {/* ============ CÓMO FUNCIONA ============ */}
      <section id="como-funciona" className="bg-paper text-ink">
        <div className="max-w-6xl mx-auto px-5 py-24">
          <p className="font-mono text-xs uppercase tracking-widest text-primary mb-3">Cómo funciona</p>
          <h2 className="font-display text-3xl sm:text-4xl max-w-2xl leading-tight mb-14">
            De la demo a tu colegio funcionando, en tres pasos.
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.label} className="relative">
                <span className="font-display text-5xl text-primary/20">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="font-display text-lg mt-2 mb-2.5">{step.label}</h3>
                <p className="text-sm text-ink/60 leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ RESULTADOS ============ */}
      <section className="bg-ink">
        <div className="max-w-6xl mx-auto px-5 py-24">
          <p className="font-mono text-xs uppercase tracking-widest text-accent-light mb-3">Lo que cambia</p>
          <h2 className="font-display text-3xl sm:text-4xl text-white max-w-2xl leading-tight mb-14">
            Menos fricción operativa, más confianza de las familias.
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {results.map((r) => (
              <div key={r.label}>
                <p className="font-display text-4xl text-transparent bg-clip-text bg-gradient-to-r from-accent-light to-coral">{r.stat}</p>
                <p className="font-mono text-[11px] uppercase tracking-widest text-white/40 mb-3">{r.label}</p>
                <p className="text-sm text-white/60 leading-relaxed">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="bg-paper text-ink">
        <div className="max-w-3xl mx-auto px-5 py-24">
          <p className="font-mono text-xs uppercase tracking-widest text-primary mb-3">Preguntas frecuentes</p>
          <h2 className="font-display text-3xl sm:text-4xl leading-tight mb-12">
            Respuestas directas, sin letra pequeña.
          </h2>

          <div className="divide-y divide-black/10">
            {faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-display text-lg">
                  {f.q}
                  <span className="shrink-0 text-primary transition group-open:rotate-45 text-2xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm text-ink/65 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============ DEMO / LEAD FORM ============ */}
      <section id="demo" className="bg-ink relative overflow-hidden">
        <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[40rem] h-[20rem] bg-coral/15 rounded-full blur-[120px]" />
        <div className="relative max-w-4xl mx-auto px-5 py-24">
          <div className="text-center mb-10">
            <p className="font-mono text-xs uppercase tracking-widest text-coral mb-3">Solicitar demo</p>
            <h2 className="font-display text-3xl sm:text-4xl text-white leading-tight">
              Cuéntanos de tu colegio y te mostramos el sistema funcionando.
            </h2>
            <p className="mt-4 text-white/55 max-w-lg mx-auto">
              Sin presentaciones genéricas: te mostramos el panel de tu rol, con tu colegio.
            </p>
          </div>
          <LeadForm />
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-ink border-t border-white/10">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-md bg-primary flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
              </svg>
            </span>
            <span className="font-display text-sm text-white/70">MentorIApp</span>
          </div>
          <p className="text-xs text-white/35 font-mono">Plataforma para redes y colegios afiliados</p>
          <Link href="/terminos" className="text-xs text-white/50 hover:text-white/80 transition font-mono">
            Tus datos son tuyos →
          </Link>
        </div>
      </footer>
    </div>
  )
}
