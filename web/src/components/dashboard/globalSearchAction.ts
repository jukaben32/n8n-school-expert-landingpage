'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveSchool } from '@/lib/activeSchool'
import { canAccess } from '@/lib/permissions'
import { roleLabels as staffRoleLabels } from '@/lib/staff/roleLabels'

export interface SearchResult {
  type: 'estudiante' | 'personal' | 'tutor' | 'familia' | 'factura'
  id: string
  label: string
  sublabel?: string
  href: string
}

/**
 * Parte lo que se escribió en palabras sueltas y las limpia.
 *
 * Los dos motivos, los dos reales:
 *
 * 1. Antes se mandaba la frase entera contra cada columna
 *    (`first_name.ilike.%Vianela Santana%`), así que buscar a alguien por
 *    su NOMBRE COMPLETO -- que es como lo escribe cualquiera -- nunca
 *    encontraba nada: ninguna columna contiene nombre y apellido juntos.
 *    Reportado por el colegio el 2026-09-15 ("el buscador no funciona").
 *    Partiendo en palabras, cada una se exige por separado contra nombre
 *    O apellido, y "Vianela Santana" sí encuentra a Vianela Santana.
 *
 * 2. Una coma, un paréntesis o un `%` en lo que se teclea rompen la
 *    sintaxis del filtro `or=(...)` de PostgREST. Como esta función
 *    ignoraba el `error` de cada consulta, eso se veía exactamente igual
 *    que "sin resultados" -- el fallo silencioso que este proyecto ya
 *    sufrió en otras pantallas.
 */
function splitTerms(query: string): string[] {
  return query
    .split(/\s+/)
    .map((w) => w.replace(/[,()%*\\"']/g, '').trim())
    .filter((w) => w.length >= 2)
    .slice(0, 4)
}

/**
 * Búsqueda global de la barra superior -- personas (estudiantes, personal
 * y tutores), familias y facturas. Usa el cliente con sesión (no el admin)
 * para que las políticas de RLS ya existentes por rol sigan siendo la
 * única fuente de verdad de qué puede ver cada quien; solo lanza cada
 * sub-búsqueda si el rol tiene acceso al módulo correspondiente, para no
 * gastar consultas de más en roles que de todos modos no verían resultados.
 */
export async function globalSearchAction(query: string): Promise<SearchResult[]> {
  const term = query.trim()
  if (term.length < 2) return []

  const words = splitTerms(term)
  if (words.length === 0) return []

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
  const results: SearchResult[] = []

  /** Cada palabra debe aparecer en el nombre O en el apellido. */
  const byFullName = <T extends { or: (f: string) => T }>(q: T): T =>
    words.reduce((acc, w) => acc.or(`first_name.ilike.%${w}%,last_name.ilike.%${w}%`), q)

  const tasks: (() => Promise<void>)[] = []

  if (canAccess(profile.role, 'estudiantes')) {
    tasks.push(async () => {
      const { data, error } = await byFullName(
        supabase
          .from('students')
          .select('id, first_name, last_name, grade_level')
          .eq('school_id', schoolId)
          .is('deleted_at', null)
      ).limit(5)
      if (error) console.error('[buscador/estudiantes]', error)
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

  // Personal: faltaba por completo, aunque es de lo que más se busca desde
  // la propia pantalla de Personal (el reporte del 2026-09-15 fue buscando
  // a una docente por su nombre).
  if (canAccess(profile.role, 'personal')) {
    tasks.push(async () => {
      const { data, error } = await byFullName(
        supabase
          .from('staff')
          .select('id, first_name, last_name, role')
          .eq('school_id', schoolId)
          .is('deleted_at', null)
      ).limit(5)
      if (error) console.error('[buscador/personal]', error)
      for (const s of data ?? []) {
        results.push({
          type: 'personal',
          id: s.id as string,
          label: `${s.first_name} ${s.last_name}`,
          sublabel: staffRoleLabels[s.role as string] ?? (s.role as string),
          href: `/dashboard/personal?abrir=${s.id}`,
        })
      }
    })
  }

  if (canAccess(profile.role, 'familias')) {
    tasks.push(async () => {
      const { data, error } = await byFullName(
        supabase
          .from('guardians')
          .select('id, first_name, last_name, family_id, families(name)')
          .eq('school_id', schoolId)
          .is('deleted_at', null)
      ).limit(5)
      if (error) console.error('[buscador/tutores]', error)
      type Row = { id: string; first_name: string; last_name: string; family_id: string; families: { name: string } | null }
      for (const g of (data ?? []) as unknown as Row[]) {
        results.push({
          type: 'tutor',
          id: g.id,
          label: `${g.first_name} ${g.last_name}`,
          sublabel: g.families?.name,
          href: `/dashboard/familias/${g.family_id}`,
        })
      }
    })

    tasks.push(async () => {
      let q = supabase
        .from('families')
        .select('id, name')
        .eq('school_id', schoolId)
        .is('deleted_at', null)
      for (const w of words) q = q.ilike('name', `%${w}%`)
      const { data, error } = await q.limit(5)
      if (error) console.error('[buscador/familias]', error)
      for (const f of data ?? []) {
        results.push({ type: 'familia', id: f.id as string, label: f.name as string, href: `/dashboard/familias/${f.id}` })
      }
    })

    tasks.push(async () => {
      let q = supabase
        .from('invoices')
        .select('id, description, family_id, families(name)')
        .eq('school_id', schoolId)
        .is('deleted_at', null)
      for (const w of words) q = q.ilike('description', `%${w}%`)
      const { data, error } = await q.limit(5)
      if (error) console.error('[buscador/facturas]', error)
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
