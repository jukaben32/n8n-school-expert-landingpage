'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Guardian {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  relationship: string
  is_primary: boolean
  national_id: string | null
}

interface Family {
  id: string
  name: string
  billing_email: string | null
  billing_phone: string | null
}

interface EditableGuardian {
  id?: string // presente si ya existe en la base; ausente si es nuevo
  key: string
  firstName: string
  lastName: string
  phone: string
  email: string
  relationship: string
  isPrimary: boolean
  nationalId: string
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

const relationshipLabels: Record<string, string> = {
  madre: 'Madre', padre: 'Padre', tutor_legal: 'Tutor legal', otro: 'Otro',
}

function fromExisting(g: Guardian): EditableGuardian {
  return {
    id: g.id, key: g.id, firstName: g.first_name, lastName: g.last_name,
    phone: g.phone, email: g.email ?? '', relationship: g.relationship, isPrimary: g.is_primary,
    nationalId: g.national_id ?? '',
  }
}

function newDraft(): EditableGuardian {
  return { key: crypto.randomUUID(), firstName: '', lastName: '', phone: '', email: '', relationship: 'tutor_legal', isPrimary: false, nationalId: '' }
}

export default function EditFamilyForm({ schoolId, family, initialGuardians }: { schoolId: string; family: Family; initialGuardians: Guardian[] }) {
  const router = useRouter()
  const [name, setName] = useState(family.name)
  const [billingEmail, setBillingEmail] = useState(family.billing_email ?? '')
  const [billingPhone, setBillingPhone] = useState(family.billing_phone ?? '')
  const [guardians, setGuardians] = useState<EditableGuardian[]>(initialGuardians.map(fromExisting))
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function updateGuardian(key: string, patch: Partial<EditableGuardian>) {
    setGuardians((prev) => prev.map((g) => (g.key === key ? { ...g, ...patch } : g)))
  }
  function setPrimary(key: string) {
    setGuardians((prev) => prev.map((g) => ({ ...g, isPrimary: g.key === key })))
  }
  function addGuardian() {
    setGuardians((prev) => (prev.length >= 4 ? prev : [...prev, newDraft()]))
  }
  function removeGuardian(g: EditableGuardian) {
    if (guardians.length <= 1) return
    if (g.id) setRemovedIds((prev) => [...prev, g.id as string])
    setGuardians((prev) => prev.filter((x) => x.key !== g.key))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)

    for (const g of guardians) {
      if (!g.firstName || !g.lastName || !g.phone) {
        setError('Completa nombre, apellido y teléfono de cada tutor.')
        return
      }
    }

    setSaving(true)
    const supabase = createClient()

    try {
      // 1. Actualizar datos de la familia
      const { error: familyError } = await supabase
        .from('families')
        .update({ name: name.trim(), billing_email: billingEmail.trim() || null, billing_phone: billingPhone.trim() || null })
        .eq('id', family.id)
      if (familyError) throw familyError

      // 2. Tutores eliminados: primero desvincular de todos sus estudiantes
      //    (la tabla no borra en cascada), luego eliminar el registro.
      for (const guardianId of removedIds) {
        const { error: unlinkError } = await supabase.from('student_guardians').delete().eq('guardian_id', guardianId)
        if (unlinkError) throw unlinkError
        const { error: deleteError } = await supabase.from('guardians').delete().eq('id', guardianId)
        if (deleteError) throw deleteError
      }

      // 3. Tutores existentes: actualizar
      for (const g of guardians.filter((x) => x.id)) {
        const { error: updateError } = await supabase
          .from('guardians')
          .update({
            first_name: g.firstName, last_name: g.lastName, phone: g.phone,
            email: g.email || null, relationship: g.relationship, is_primary: g.isPrimary,
            national_id: g.nationalId || null,
          })
          .eq('id', g.id as string)
        if (updateError) throw updateError
      }

      // 4. Tutores nuevos: crear y vincular a todos los estudiantes de la familia
      const newGuardians = guardians.filter((x) => !x.id)
      if (newGuardians.length > 0) {
        const { data: familyStudents } = await supabase.from('students').select('id').eq('family_id', family.id).is('deleted_at', null)

        for (const g of newGuardians) {
          const { data: created, error: createError } = await supabase
            .from('guardians')
            .insert({
              school_id: schoolId, family_id: family.id, first_name: g.firstName, last_name: g.lastName,
              phone: g.phone, email: g.email || null, relationship: g.relationship, is_primary: g.isPrimary,
              national_id: g.nationalId || null,
            })
            .select('id')
            .single()
          if (createError || !created) throw createError ?? new Error('No se pudo crear el tutor nuevo.')

          if (familyStudents && familyStudents.length > 0) {
            const { error: linkError } = await supabase.from('student_guardians').insert(
              familyStudents.map((s) => ({ student_id: s.id, guardian_id: created.id, relationship: g.relationship, is_primary: g.isPrimary }))
            )
            if (linkError) throw linkError
          }
        }
      }

      setRemovedIds([])
      setSaved(true)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message || 'Ocurrió un error al guardar.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Datos de la familia</p>
        <div>
          <label htmlFor="name" className={labelClass}>Nombre de la familia</label>
          <input id="name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="billingEmail" className={labelClass}>Correo de facturación</label>
            <input id="billingEmail" type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="billingPhone" className={labelClass}>Teléfono de facturación</label>
            <input id="billingPhone" value={billingPhone} onChange={(e) => setBillingPhone(e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Padres / tutores
        </p>

        {guardians.map((g) => (
          <div key={g.key} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <input type="radio" name="primary" checked={g.isPrimary} onChange={() => setPrimary(g.key)} />
                Tutor principal
              </label>
              {guardians.length > 1 && (
                <button type="button" onClick={() => removeGuardian(g)} className="text-xs text-red-500 hover:text-red-600">
                  Quitar de la familia
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`fn-${g.key}`} className={labelClass}>Nombre</label>
                <input id={`fn-${g.key}`} required value={g.firstName} onChange={(e) => updateGuardian(g.key, { firstName: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor={`ln-${g.key}`} className={labelClass}>Apellido</label>
                <input id={`ln-${g.key}`} required value={g.lastName} onChange={(e) => updateGuardian(g.key, { lastName: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor={`ph-${g.key}`} className={labelClass}>Teléfono</label>
                <input id={`ph-${g.key}`} required value={g.phone} onChange={(e) => updateGuardian(g.key, { phone: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor={`em-${g.key}`} className={labelClass}>Correo (opcional)</label>
                <input id={`em-${g.key}`} type="email" value={g.email} onChange={(e) => updateGuardian(g.key, { email: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor={`ni-${g.key}`} className={labelClass}>Cédula (opcional)</label>
                <input id={`ni-${g.key}`} value={g.nationalId} onChange={(e) => updateGuardian(g.key, { nationalId: e.target.value })}
                  placeholder="000-0000000-0" className={inputClass} />
              </div>
              <div className="col-span-2">
                <label htmlFor={`rel-${g.key}`} className={labelClass}>Parentesco</label>
                <select id={`rel-${g.key}`} value={g.relationship} onChange={(e) => updateGuardian(g.key, { relationship: e.target.value })} className={inputClass}>
                  {Object.entries(relationshipLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}

        {guardians.length < 4 && (
          <button
            type="button"
            onClick={addGuardian}
            className="w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:border-primary/40 transition"
          >
            + Agregar otro padre/madre/tutor
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      {saved && (
        <div role="status" className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          ✓ Guardado.
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition shadow-glow disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-slate-200 dark:border-slate-700 px-6 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          Volver
        </button>
      </div>
    </form>
  )
}
