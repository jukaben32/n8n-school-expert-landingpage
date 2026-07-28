import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { redirect, notFound } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import QueryErrorBanner from '@/components/dashboard/QueryErrorBanner'

export const metadata: Metadata = {
  title: 'Ficha de familia — SchoolOS',
}

const statusStyles: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  pagado: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  vencido: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  anulado: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

export default async function FamiliaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  if (profileError) console.error('[perfil]', profileError)

  const { schoolId } = await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')

  if (!profile || !canAccess(profile.role, 'familias')) {
    redirect('/dashboard')
  }

  const { data: family, error: familyError } = await supabase
    .from('families')
    .select('id, name, billing_email, billing_phone')
    .eq('id', id)
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .single()

  if (!family) notFound()

  const [{ data: guardiansRaw, error: guardiansRawError }, { data: studentsRaw, error: studentsRawError }, { data: invoicesRaw, error: invoicesRawError }] = await Promise.all([
    supabase.from('guardians').select('id, first_name, last_name, phone, email, relationship, is_primary').eq('family_id', id).order('is_primary', { ascending: false }),
    supabase.from('students').select('id, first_name, last_name, enrollment_status').eq('family_id', id).is('deleted_at', null),
    supabase.from('invoices').select('id, description, total_amount, status, due_date').eq('family_id', id).is('deleted_at', null).order('due_date', { ascending: false }),
  ])

  type Guardian = { id: string; first_name: string; last_name: string; phone: string; email: string | null; relationship: string; is_primary: boolean }
  const guardians = (guardiansRaw ?? []) as Guardian[]
  type StudentRow = { id: string; first_name: string; last_name: string; enrollment_status: string | null }
  const students = (studentsRaw ?? []) as StudentRow[]
  type Invoice = { id: string; description: string; total_amount: number; status: string; due_date: string }
  const invoices = (invoicesRaw ?? []) as Invoice[]

  const formatDOP = (amount: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount)
  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
  const totalPending = invoices.filter((i) => i.status === 'pendiente' || i.status === 'vencido').reduce((sum, i) => sum + Number(i.total_amount), 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <QueryErrorBanner errors={[{ label: 'la familia', error: familyError }, { label: 'los tutores', error: guardiansRawError }, { label: 'los estudiantes', error: studentsRawError }, { label: 'las facturas', error: invoicesRawError }]} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/familias" className="text-xs font-semibold text-slate-400 hover:text-primary dark:hover:text-accent-light transition">
            ← Familias
          </Link>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-2">{family.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {family.billing_email ?? 'Sin correo de facturación'} {family.billing_phone ? `· ${family.billing_phone}` : ''}
          </p>
        </div>
        <Link
          href={`/dashboard/familias/${family.id}/editar`}
          className="shrink-0 rounded-full border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          Editar
        </Link>
      </div>

      {/* Estado de cuenta */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Estado de cuenta</p>
          <p className={`text-lg font-black ${totalPending > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {formatDOP(totalPending)} <span className="text-xs font-normal text-slate-400">pendiente</span>
          </p>
        </div>
        {invoices.length > 0 ? (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-sm border-t border-slate-100 dark:border-slate-800 pt-2 first:border-0 first:pt-0">
                <div className="min-w-0">
                  <p className="text-slate-700 dark:text-slate-200 truncate">{inv.description}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Vence {formatDate(inv.due_date)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-semibold text-slate-900 dark:text-white">{formatDOP(inv.total_amount)}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusStyles[inv.status] ?? ''}`}>{inv.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">Sin facturas registradas.</p>
        )}
      </div>

      {/* Hijos */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Estudiantes</p>
        {students.length > 0 ? (
          <div className="space-y-2">
            {students.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/estudiantes/${s.id}`}
                className="flex items-center justify-between text-sm border-t border-slate-100 dark:border-slate-800 pt-2 first:border-0 first:pt-0 hover:text-primary dark:hover:text-accent-light transition"
              >
                <span className="text-slate-700 dark:text-slate-200">{s.first_name} {s.last_name}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{s.enrollment_status ?? 'prospecto'}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">Sin estudiantes vinculados.</p>
        )}
      </div>

      {/* Tutores */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Tutores</p>
        {guardians.length > 0 ? (
          <div className="space-y-3">
            {guardians.map((g) => (
              <div key={g.id} className="flex items-center justify-between text-sm border-t border-slate-100 dark:border-slate-800 pt-3 first:border-0 first:pt-0">
                <div>
                  <p className="text-slate-700 dark:text-slate-200 font-medium">
                    {g.first_name} {g.last_name}
                    {g.is_primary && <span className="ml-2 text-[10px] font-bold uppercase text-primary dark:text-accent-light">Principal</span>}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{g.relationship} · {g.phone}{g.email ? ` · ${g.email}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">Sin tutores registrados.</p>
        )}
      </div>
    </div>
  )
}
