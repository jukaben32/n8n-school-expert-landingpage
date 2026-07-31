import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { listPendingReceipts } from '../actions'
import ReceiptsReview from './ReceiptsReview'

export const metadata: Metadata = {
  title: 'Comprobantes de transferencia — MentorIApp',
}

export default async function ComprobantesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()

  await getActiveSchool(profile?.role ?? '', profile?.school_id ?? '')

  if (!profile || !canAccess(profile.role, 'tesoreria')) {
    redirect('/dashboard')
  }

  const receipts = await listPendingReceipts()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Comprobantes de transferencia
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Revisa las transferencias que las familias reportaron y confirma o rechaza cada una.
        </p>
      </div>

      <ReceiptsReview initialReceipts={receipts} />
    </div>
  )
}
