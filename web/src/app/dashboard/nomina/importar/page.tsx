import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/permissions'
import ImportForm from './ImportForm'

export const metadata: Metadata = { title: 'Cargar nómina — MentorIApp' }

export default async function ImportarNominaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users_profiles').select('role').eq('auth_id', user.id).single()
  if (!profile || !canAccess(profile.role, 'nomina_gestionar')) redirect('/dashboard')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/nomina" className="text-sm font-semibold" style={{ color: 'var(--dash-accent-light)' }}>← Nómina</Link>
      <div>
        <h1 className="text-2xl font-bold font-barlow text-slate-900 tracking-tight">Cargar nómina cerrada</h1>
        <ol className="text-sm text-slate-500 mt-2 list-decimal pl-5 space-y-1">
          <li>En el libro de Excel, hoja <b>Cierres</b>, seleccione las filas del período que acaba de cerrar (columnas <b>A a Z</b>) y copie (Ctrl+C).</li>
          <li>Pegue aquí abajo (Ctrl+V) y toque <b>Revisar</b>. Nada se guarda todavía.</li>
          <li>Confirme a qué empleado corresponde cada ID (solo la primera vez) y toque <b>Guardar como borrador</b>.</li>
          <li>Luego publique el período desde la lista: hasta entonces <b>nadie más que Dirección</b> lo ve.</li>
        </ol>
      </div>
      <ImportForm />
    </div>
  )
}
