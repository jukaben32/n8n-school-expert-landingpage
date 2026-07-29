import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import SchoolConfigForm from './SchoolConfigForm'
import ExportDataButton from './ExportDataButton'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'
import AzulSettingsForm from './AzulSettingsForm'
import { getPaymentSettingsDisplay } from './paymentSettingsActions'

export const metadata: Metadata = {
  title: 'Configuración del colegio — SchoolOS',
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
    .select('id, name, subdomain, tagline, logo_url, address, phone, email, sibling_discount_min_children, sibling_discount_percent')
    .eq('id', schoolId)
    .single()

  if (!school) redirect('/dashboard')

  const paymentSettings = await getPaymentSettingsDisplay()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'los datos del colegio', error: schoolError }]} />
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Configuración del colegio
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Esta información aparece en la página pública de bienvenida de tu colegio.
        </p>
      </div>
      <SchoolConfigForm school={school} />
      {paymentSettings && <AzulSettingsForm initial={paymentSettings} />}
      <ExportDataButton schoolSubdomain={school.subdomain} />
    </div>
  )
}
