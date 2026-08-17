import type { Metadata } from 'next'
import { Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import ConfigTabs from './ConfigTabs'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import { getPaymentSettingsDisplay } from './paymentSettingsActions'

export const metadata: Metadata = {
  title: 'Configuración del colegio — MentorIApp',
}

export default async function ColegioConfigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  if (!profile || !canAccess(profile.role, 'configuracion_colegio')) {
    redirect('/dashboard')
  }

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)

  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('id, name, tagline, subdomain, address, phone, email, sibling_discount_min_children, sibling_discount_percent, faq_document')
    .eq('id', schoolId)
    .single()

  if (!school) redirect('/dashboard')

  const paymentSettings = await getPaymentSettingsDisplay()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <QueryErrorBanner errors={[
        { label: 'los datos del colegio', error: schoolError },
        { label: 'la configuración de pagos', error: paymentSettings.ok ? null : { message: paymentSettings.error ?? 'error desconocido' } },
      ]} />
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-primary/10 text-primary dark:bg-accent-light/10 dark:text-accent-light grid place-items-center shrink-0">
          <Settings className="w-4.5 h-4.5" />
        </span>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Configuración
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Perfil del colegio y configuración operativa.
          </p>
        </div>
      </div>
      <ConfigTabs school={school} paymentSettings={paymentSettings.ok ? paymentSettings.data ?? null : null} />
    </div>
  )
}
