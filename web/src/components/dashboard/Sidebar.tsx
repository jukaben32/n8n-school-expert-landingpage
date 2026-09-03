'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useMobileNav } from './MobileNavContext'

// Íconos SVG compactos
const icons = {
  home: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
    </svg>
  ),
  students: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  attendance: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  messages: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  ),
  agenda: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-13.5-4.5h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm3-3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm3-3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  ),
  autorizaciones: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  encuestas: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  notas: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  ),
  planificacion: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
    </svg>
  ),
  horarios: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  payments: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
  families: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
  reports: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  academia: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443" />
    </svg>
  ),
  plataforma: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  ),
  personal: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  configuracion: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  asistente_ia: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  ),
  whatsapp: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75c-4.556 0-8.25 3.42-8.25 7.636 0 1.896.756 3.636 2.003 4.97L5.25 20.25l4.003-1.159A9.24 9.24 0 0012 16.623c4.556 0 8.25-3.42 8.25-7.637S16.556 3.75 12 3.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75c.16 1.095.59 2.126 1.248 2.99.71.94 1.664 1.695 2.764 2.186.454.202.972.15 1.377-.144l.78-.57a.75.75 0 01.846-.024l1.031.62a.75.75 0 01.309.909c-.365 1.016-1.406 1.662-2.483 1.472-1.682-.299-3.245-1.203-4.44-2.428-1.196-1.226-2.06-2.808-2.44-4.542-.244-1.116.42-2.26 1.5-2.65l1.107-.4a.75.75 0 01.903.314l.564.942a.75.75 0 01-.11.92l-.74.74z" />
    </svg>
  ),
  website: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25A8.25 8.25 0 1012 3.75a8.25 8.25 0 000 16.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75c2.25 2.016 3.375 4.5 3.375 8.25S14.25 17.984 12 20.25c-2.25-2.266-3.375-4.75-3.375-8.25S9.75 5.766 12 3.75z" />
    </svg>
  ),
  logout: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  ),
}

type NavItem = { href: string; label: string; icon: keyof typeof icons }
type NavGroup = { title?: string; items: NavItem[] }

// Definición de rutas según rol -- agrupadas para el rol "default"
// (dirección/administración/personal), igual que en el rediseño original
// (grupos "Operación", "Académico", "Comunicación", "Sistema" -- extraídos
// del código fuente del diseño, no inventados). Los roles con menús más
// cortos quedan en un solo grupo sin encabezado.
const navByRole: Record<string, NavGroup[]> = {
  guardian: [{ items: [
    { href: '/dashboard/portal-familiar', label: 'Inicio', icon: 'home' },
    { href: '/dashboard/comunicados',     label: 'Comunicados', icon: 'messages' },
    { href: '/dashboard/agenda',          label: 'Agenda', icon: 'agenda' },
    { href: '/dashboard/horarios',        label: 'Horario', icon: 'horarios' },
    { href: '/dashboard/autorizaciones',  label: 'Autorizaciones', icon: 'autorizaciones' },
    { href: '/dashboard/asistencia',      label: 'Asistencia', icon: 'attendance' },
    { href: '/dashboard/pagos',           label: 'Pagos', icon: 'payments' },
  ] }],
  // Tutor con algún hijo con mora de más de 60 días (Fase 2 de Cuentas por
  // Cobrar) -- dashboard/layout.tsx ya redirige a /dashboard/pagos en cada
  // navegación, esto solo evita mostrar en el menú opciones a las que de
  // todas formas será redirigido si las toca. Nunca se aplica al estudiante.
  guardian_blocked: [{ items: [
    { href: '/dashboard/pagos',           label: 'Pagos', icon: 'payments' },
  ] }],
  // Estudiante: exactamente lo que pidió el colegio -- Academia y
  // Encuestas. A propósito NO lleva Comunicados ni Agenda: esas pantallas
  // están escritas para el personal y los tutores (sus policies filtran
  // por guardian_id/staff), así que a un estudiante le saldrían vacías.
  student: [{ items: [
    { href: '/dashboard/academia',        label: 'Academia', icon: 'academia' },
    { href: '/dashboard/encuestas',       label: 'Encuestas', icon: 'encuestas' },
  ] }],
  // Mensajes y Actualizaciones estaban en la matriz de permisos del profesor
  // ('mensajes_directos' y 'actualizaciones') desde siempre, pero el enlace
  // nunca se agregó acá -- así que en la práctica no existían para él.
  // Reporte real del colegio (2026-09-03): "los docentes tienen deshabilitada
  // la opción de mensajes, solo tienen comunicado, que le llega a todos los
  // padres del curso; si quieren un mensaje específico a un padre, no lo
  // tienen" y "la opción de la foto la deben habilitar" (la autorización de
  // uso de imagen ya la están firmando los padres).
  teacher: [{ items: [
    { href: '/dashboard/asistencia',      label: 'Asistencia', icon: 'attendance' },
    { href: '/dashboard/academia/progreso', label: 'Academia', icon: 'academia' },
    { href: '/dashboard/comunicados',     label: 'Comunicados', icon: 'messages' },
    { href: '/dashboard/mensajes',        label: 'Mensajes', icon: 'messages' },
    { href: '/dashboard/actualizaciones', label: 'Actualizaciones', icon: 'academia' },
    { href: '/dashboard/agenda',          label: 'Agenda', icon: 'agenda' },
    { href: '/dashboard/horarios',        label: 'Horario', icon: 'horarios' },
    { href: '/dashboard/planificacion',   label: 'Planificación', icon: 'planificacion' },
    { href: '/dashboard/notas',           label: 'Notas', icon: 'notas' },
    { href: '/dashboard/autorizaciones',  label: 'Autorizaciones', icon: 'autorizaciones' },
    { href: '/dashboard/encuestas',       label: 'Encuestas', icon: 'encuestas' },
  ] }],
  super_admin: [{ items: [
    { href: '/dashboard/plataforma',      label: 'Plataforma', icon: 'plataforma' },
    { href: '/dashboard/plataforma/leads', label: 'Leads', icon: 'messages' },
  ] }],
  reception: [{ items: [
    { href: '/dashboard/estudiantes',     label: 'Estudiantes', icon: 'students' },
    { href: '/dashboard/familias',        label: 'Familias', icon: 'families' },
    { href: '/dashboard/mensajes',        label: 'Mensajes', icon: 'messages' },
    { href: '/dashboard/comunicados',     label: 'Comunicados', icon: 'messages' },
    { href: '/dashboard/agenda',          label: 'Agenda', icon: 'agenda' },
    { href: '/dashboard/horarios',        label: 'Horarios', icon: 'horarios' },
    { href: '/dashboard/notas',           label: 'Notas', icon: 'notas' },
    { href: '/dashboard/autorizaciones',  label: 'Autorizaciones', icon: 'autorizaciones' },
    { href: '/dashboard/tesoreria',       label: 'Tesorería', icon: 'payments' },
    { href: '/dashboard/pagos',           label: 'Pagos', icon: 'payments' },
    { href: '/dashboard/asistencia',      label: 'Asistencia', icon: 'attendance' },
  ] }],
  finance: [{ items: [
    { href: '/dashboard/tesoreria',       label: 'Tesorería', icon: 'payments' },
    { href: '/dashboard/pagos',           label: 'Pagos', icon: 'payments' },
    { href: '/dashboard/familias',        label: 'Familias', icon: 'families' },
    { href: '/dashboard/reportes',        label: 'Analíticas', icon: 'reports' },
  ] }],
  default: [
    { title: 'Operación', items: [
      { href: '/dashboard/secretaria',      label: 'Panel', icon: 'home' },
      { href: '/dashboard/estudiantes',     label: 'Estudiantes', icon: 'students' },
      { href: '/dashboard/familias',        label: 'Familias', icon: 'families' },
      { href: '/dashboard/personal',        label: 'Personal', icon: 'personal' },
      { href: '/dashboard/tesoreria',       label: 'Tesorería', icon: 'payments' },
    ] },
    { title: 'Académico', items: [
      { href: '/dashboard/academia/progreso', label: 'Academia', icon: 'academia' },
      { href: '/dashboard/notas',           label: 'Notas', icon: 'notas' },
      { href: '/dashboard/asistencia',      label: 'Asistencia', icon: 'attendance' },
      { href: '/dashboard/horarios',        label: 'Horarios', icon: 'horarios' },
      { href: '/dashboard/planificacion',   label: 'Planificación', icon: 'planificacion' },
    ] },
    { title: 'Comunicación', items: [
      { href: '/dashboard/comunicados',     label: 'Comunicados', icon: 'messages' },
      { href: '/dashboard/mensajes',        label: 'Mensajes', icon: 'messages' },
      { href: '/dashboard/actualizaciones', label: 'Actualizaciones', icon: 'academia' },
      { href: '/dashboard/agenda',          label: 'Agenda', icon: 'agenda' },
      { href: '/dashboard/autorizaciones',  label: 'Autorizaciones', icon: 'autorizaciones' },
      { href: '/dashboard/encuestas',       label: 'Encuestas', icon: 'encuestas' },
    ] },
    { title: 'Sistema', items: [
      { href: '/dashboard/reportes',        label: 'Analíticas', icon: 'reports' },
      { href: '/dashboard/asistente-ia',    label: 'Asistente de IA', icon: 'asistente_ia' },
      { href: '/dashboard/whatsapp',        label: 'WhatsApp', icon: 'whatsapp' },
      { href: '/dashboard/website',         label: 'Sitio Web', icon: 'website' },
      { href: '/dashboard/colegio',         label: 'Configuración', icon: 'configuracion' },
    ] },
  ],
}

interface SidebarProps {
  role: string
  schoolName: string
  newLeadsCount?: number
  newMessagesCount?: number
  /** Si este perfil de personal también está vinculado a una ficha de tutor (doble rol). */
  guardianId?: string | null
}

/**
 * Sidebar — Navegación lateral del dashboard.
 * Adapta los ítems de menú según el rol del usuario.
 */
export default function Sidebar({ role, schoolName, newLeadsCount = 0, newMessagesCount = 0, guardianId = null }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const navGroups = navByRole[role] ?? navByRole.default
  const { isOpen, close } = useMobileNav()

  // Cierra el cajón móvil solo automáticamente al navegar a otra página --
  // así el clic que dispara la navegación no queda peleando con el cierre.
  useEffect(() => {
    close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Fondo oscuro detrás del cajón móvil -- clic para cerrar */}
      {isOpen && (
        <div
          onClick={close}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
        />
      )}

      <aside
        className={`dash-bar print:hidden fixed inset-y-0 left-0 z-50 flex flex-col w-72 max-w-[85vw] border-r shrink-0 transition-transform duration-200 ease-out md:static md:z-auto md:w-64 md:max-w-none md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >

      {/* Logo del colegio */}
      <div className="px-5 py-5 border-b border-dash-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-dash-accent flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-dash-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422A12.083 12.083 0 0121 13c0 4.418-3.582 8-8 8S5 17.418 5 13c0-.935.164-1.832.463-2.668L12 14z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold font-barlow uppercase tracking-widest text-dash-accent-light">MentorIApp</p>
            <p className="text-sm font-medium text-dash-text truncate">{schoolName}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar menú"
            className="md:hidden shrink-0 p-1.5 rounded-lg text-dash-text-faint hover:bg-dash-surface transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Ítems de navegación, agrupados */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Menú principal">
        {navGroups.map((group, gi) => (
          <div key={group.title ?? gi} className={gi > 0 ? 'mt-4' : ''}>
            {group.title && (
              <p className="px-3 mb-1.5 text-[10px] font-bold font-barlow uppercase tracking-[0.16em] text-dash-text-faint">
                {group.title}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 pl-2.5 pr-3 py-2.5 rounded-xl text-sm font-medium transition border-l-2 ${
                      isActive
                        ? 'border-dash-accent bg-[rgba(16,185,129,0.22)] text-dash-text'
                        : 'border-transparent text-dash-text-muted hover:bg-dash-surface hover:text-dash-text'
                    }`}
                  >
                    {icons[item.icon]}
                    <span className="flex-1">{item.label}</span>
                    {item.href === '/dashboard/plataforma/leads' && newLeadsCount > 0 && (
                      <span className="rounded-full bg-dash-notify text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {newLeadsCount}
                      </span>
                    )}
                    {item.href === '/dashboard/mensajes' && newMessagesCount > 0 && (
                      <span className="rounded-full bg-dash-notify text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {newMessagesCount}
                      </span>
                    )}
                  </a>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Doble rol: personal que también es tutor de un hijo aquí */}
      {guardianId && (
        <div className="px-3 py-3 border-t border-dash-border">
          <a
            href="/dashboard/portal-familiar"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dash-warning bg-dash-warning/10 hover:bg-dash-warning/20 transition"
          >
            <span aria-hidden="true">👪</span>
            <span className="flex-1">Vista de Familia</span>
          </a>
        </div>
      )}

      {/* Botón cerrar sesión */}
      <div className="px-3 py-4 border-t border-dash-border">
        <button
          id="sidebar-logout-btn"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dash-text-faint hover:bg-dash-danger-bg hover:text-dash-danger-strong transition"
        >
          {icons.logout}
          Cerrar sesión
        </button>
      </div>
      </aside>
    </>
  )
}
