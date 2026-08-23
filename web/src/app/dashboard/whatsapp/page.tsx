import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import { getActiveSchool } from '@/lib/activeSchool'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import WhatsAppManager from './WhatsAppConnectionForm'
import type { WhatsAppConnectionRow } from '@/lib/whatsapp/connection'

export const metadata: Metadata = {
  title: 'WhatsApp — MentorIApp',
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
    .select('id, school_id, provider, assistant_name, phone_number, instance_name, status, is_enabled, created_at, updated_at')
    .eq('school_id', schoolId)
    .maybeSingle()

  const currentConnection = (connection ? { ...connection, instance_token: null } : null) as WhatsAppConnectionRow | null

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <QueryErrorBanner errors={[
        { label: 'la configuración de WhatsApp', error: connectionError },
      ]} />

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary dark:text-accent-light mb-2">
          Setup
        </p>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">
          WhatsApp
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-3xl">
          Conecta el número de WhatsApp del colegio para que el mismo asistente de IA del Portal Familiar responda
          ahí también — sin n8n, directo contra Evolution API.
        </p>
      </div>

      <WhatsAppManager initialConnection={currentConnection} />
    </div>
  )
}
