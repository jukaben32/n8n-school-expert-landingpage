'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'

export interface SearchResult {
  type: 'estudiante' | 'familia' | 'factura'
  id: string
  label: string
  sublabel?: string
  href: string
}

/**
 * Búsqueda global de la barra superior -- estudiantes, familias y
 * facturas. Usa el cliente con sesión (no el admin) para que las
 * políticas de RLS ya existentes por rol sigan siendo la única fuente de
 * verdad de qué puede ver cada quien; solo lanza cada sub-búsqueda si el
 * rol tiene acceso al módulo correspondiente, para no gastar consultas
 * de más en roles que de todos modos no verían resultados.
 */
export async function globalSearchAction(query: string): Promise<SearchResult[]> {
  const term = query.trim()
  if (term.length < 2) return []

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role, school_id')
    .eq('auth_id', user.id)
    .single()
  if (!profile) return []

  const { schoolId } = await getActiveSchool(profile.role, profile.school_id)
  const like = `%${term}%`
  const results: SearchResult[] = []

  const tasks: (() => Promise<void>)[] = []

  if (canAccess(profile.role, 'estudiantes')) {
    tasks.push(async () => {
      const { data } = await supabase
        .from('students')
        .select('id, first_name, last_name, grade_level')
        .eq('school_id', schoolId)
        .is('deleted_at', null)
        .or(`first_name.ilike.${like},last_name.ilike.${like}`)
        .limit(5)
      for (const s of data ?? []) {
        results.push({
          type: 'estudiante',
          id: s.id as string,
          label: `${s.first_name} ${s.last_name}`,
          sublabel: (s.grade_level as string | null) ?? undefined,
          href: `/dashboard/estudiantes/${s.id}`,
        })
      }
    })
  }

  if (canAccess(profile.role, 'familias')) {
    tasks.push(async () => {
      const { data } = await supabase
        .from('families')
        .select('id, name')
        .eq('school_id', schoolId)
        .is('deleted_at', null)
        .ilike('name', like)
        .limit(5)
      for (const f of data ?? []) {
        results.push({ type: 'familia', id: f.id as string, label: f.name as string, href: `/dashboard/familias/${f.id}` })
      }
    })

    tasks.push(async () => {
      const { data } = await supabase
        .from('invoices')
        .select('id, description, family_id, families(name)')
        .eq('school_id', schoolId)
        .is('deleted_at', null)
        .ilike('description', like)
        .limit(5)
      type Row = { id: string; description: string; family_id: string; families: { name: string } | null }
      for (const inv of (data ?? []) as unknown as Row[]) {
        results.push({
          type: 'factura',
          id: inv.id,
          label: inv.description,
          sublabel: inv.families?.name,
          href: `/dashboard/familias/${inv.family_id}`,
        })
      }
    })
  }

  await Promise.all(tasks.map((t) => t()))
  return results
}
