import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import WhatsAppConnectionForm, { type WhatsAppConnectionRecord } from './WhatsAppConnectionForm'

export const metadata: Metadata = {
  title: 'WhatsApp — MentorIApp',
}

const statusLabels: Record<string, string> = {
  disconnected: 'Desconectado',
  connecting: 'Conectando',
  connected: 'Conectado',
  error: 'Con error',
}

const statusColors: Record<string, string> = {
  disconnected: 'bg-slate-100 text-slate-600 border-slate-200',
  connecting: 'bg-amber-50 text-amber-700 border-amber-200',
  connected: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  error: 'bg-red-50 text-red-700 border-red-200',
}

export default async function WhatsAppPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  if (!profile || !canAccess(profile.role, 'whatsapp')) {
    redirect('/dashboard')
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const { data: connection, error: connectionError } = await supabase
    .from('whatsapp_connections')
    .select('id, school_id, provider, label, assistant_name, phone_number, instance_name, api_base_url, webhook_path, status, notes, created_at, updated_at')
    .eq('school_id', schoolId)
    .maybeSingle()

  const currentConnection = (connection ?? null) as WhatsAppConnectionRecord | null
  const currentStatus = currentConnection?.status ?? 'disconnected'

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <QueryErrorBanner errors={[
        { label: 'la configuración de WhatsApp', error: connectionError },
      ]} />

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary dark:text-accent-light mb-2">
          Setup
        </p>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          WhatsApp
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-3xl">
          Conecta Evolution API directamente al asistente del colegio. No hay n8n en este flujo: la idea es dejar
          preparado el canal, el webhook y el branding para cuando el VPS esté listo.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr] items-start">
        <WhatsAppConnectionForm
          schoolId={schoolId}
          initialConnection={currentConnection}
        />

        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Flujo de conexión
            </p>
            <ol className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-accent/10 dark:text-accent-light font-bold">1</span>
                <span>Levanta Evolution API en el VPS y confirma que responda por HTTPS.</span>
              </li>
              <li className="flex gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-accent/10 dark:text-accent-light font-bold">2</span>
                <span>Pega la URL base, el nombre de la instancia y el webhook que va a escuchar los mensajes.</span>
              </li>
              <li className="flex gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-accent/10 dark:text-accent-light font-bold">3</span>
                <span>Activa el estado y deja listo el canal para que el mismo asistente responda por WhatsApp.</span>
              </li>
            </ol>
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Estado actual
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusColors[currentStatus] ?? statusColors.disconnected}`}>
                {statusLabels[currentStatus] ?? statusLabels.disconnected}
              </span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {currentConnection?.label ?? 'WhatsApp principal'}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              El canal se deja preparado hoy, aunque la prueba real quedará pendiente hasta que llegue el VPS.
            </p>
          </section>

          <section className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Qué queda listo
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300 list-disc pl-5">
              <li>Un registro único por colegio para guardar la conexión de WhatsApp.</li>
              <li>El webhook y la URL base de Evolution API listos para conectar el canal.</li>
              <li>La base de UI para que después podamos clonar el flujo completo del referente.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
