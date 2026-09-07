'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DateInputES from '@/components/DateInputES'

interface Student { id: string; first_name: string; last_name: string }
interface Family { id: string; name: string; students: Student[] }
interface Concept { id: string; name: string; amount: number; recurrence: string }

interface SiblingDiscount {
  qualifies: boolean
  sibling_rank: number | null
  enrolled_siblings: number
  discount_percent: number
}

interface NewInvoiceFormProps {
  schoolId: string
  authorProfileId: string
  families: Family[]
  concepts: Concept[]
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

function defaultDueDate() {
  const d = new Date()
  d.setDate(d.getDate() + 15)
  return d.toISOString().split('T')[0]
}

export default function NewInvoiceForm({ schoolId, authorProfileId, families, concepts }: NewInvoiceFormProps) {
  const router = useRouter()
  const [familyId, setFamilyId] = useState(families[0]?.id ?? '')
  const [studentId, setStudentId] = useState('')
  const [conceptId, setConceptId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [applyTax, setApplyTax] = useState(false)
  const [dueDate, setDueDate] = useState(defaultDueDate())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [discount, setDiscount] = useState<(SiblingDiscount & { forStudentId: string }) | null>(null)

  const selectedFamily = families.find((f) => f.id === familyId)

  // Descuento por hermanos: se calcula en la base de datos (misma regla que
  // usará el insert), no se inventa en el cliente. Solo aplica cuando se
  // factura a UN estudiante puntual, no a "toda la familia". El setState
  // solo ocurre dentro del callback async del RPC, nunca de forma síncrona
  // en el cuerpo del efecto.
  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    const supabase = createClient()
    supabase
      .rpc('calculate_sibling_discount', { p_student_id: studentId })
      .single()
      .then(({ data, error: rpcError }) => {
        if (cancelled) return
        setDiscount(rpcError || !data ? null : { ...(data as SiblingDiscount), forStudentId: studentId })
      })
    return () => { cancelled = true }
  }, [studentId])

  // El resultado solo es válido si corresponde al estudiante seleccionado
  // ahora mismo -- si se cambió de estudiante o se volvió a "toda la
  // familia", se descarta de inmediato en vez de mostrar un dato viejo.
  const activeDiscount = studentId && discount?.forStudentId === studentId ? discount : null
  const discountLoading = Boolean(studentId) && !activeDiscount
  const discountPercent = activeDiscount?.qualifies ? activeDiscount.discount_percent : 0
  const discountAmount = Math.round(Number(amount || 0) * (discountPercent / 100) * 100) / 100
  const discountedAmount = Math.round((Number(amount || 0) - discountAmount) * 100) / 100
  const taxAmount = applyTax ? Math.round(discountedAmount * 0.18 * 100) / 100 : 0
  const totalAmount = Math.round((discountedAmount + taxAmount) * 100) / 100

  const formatDOP = useMemo(() => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }), [])

  function applyConcept(id: string) {
    setConceptId(id)
    const concept = concepts.find((c) => c.id === id)
    if (concept) {
      setDescription(concept.name)
      setAmount(String(concept.amount))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!familyId || !description.trim() || !amount || Number(amount) <= 0) {
      setError('Selecciona la familia y completa descripción y monto.')
      return
    }
    setSaving(true)
    const supabase = createClient()

    try {
      const { data: ncf, error: ncfError } = await supabase.rpc('generate_ncf', {
        p_school_id: schoolId,
        p_ncf_type: '02',
      })
      if (ncfError) throw ncfError

      const { error: invoiceError } = await supabase.from('invoices').insert({
        school_id: schoolId,
        family_id: familyId,
        student_id: studentId || null,
        concept_id: conceptId || null,
        description: description.trim(),
        amount: Number(amount),
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        due_date: dueDate,
        status: 'pendiente',
        ncf,
        ncf_type: '02',
        created_by: authorProfileId,
      })
      if (invoiceError) throw invoiceError

      router.push('/dashboard/tesoreria')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo generar la factura. Intenta de nuevo.'
      setError(message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div>
          <label htmlFor="family" className={labelClass}>Familia</label>
          {families.length > 0 ? (
            <select id="family" value={familyId} onChange={(e) => { setFamilyId(e.target.value); setStudentId('') }} className={inputClass}>
              {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">No hay familias registradas todavía.</p>
          )}
        </div>

        {selectedFamily && selectedFamily.students.length > 0 && (
          <div>
            <label htmlFor="student" className={labelClass}>Estudiante (opcional)</label>
            <select id="student" value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputClass}>
              <option value="">Toda la familia</option>
              {selectedFamily.students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
            </select>
            {!studentId && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                El descuento por hermanos solo se calcula al facturar a un estudiante puntual.
              </p>
            )}
            {studentId && discountLoading && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Revisando descuento por hermanos…</p>
            )}
            {studentId && !discountLoading && activeDiscount && (
              <p className={`text-xs mt-1 ${activeDiscount.qualifies ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
                {activeDiscount.qualifies
                  ? `✓ Aplica descuento por hermanos: ${activeDiscount.discount_percent}% (hijo Nº${activeDiscount.sibling_rank} de ${activeDiscount.enrolled_siblings} inscritos en la familia).`
                  : `Sin descuento por hermanos (${activeDiscount.enrolled_siblings} hijo${activeDiscount.enrolled_siblings !== 1 ? 's' : ''} inscrito${activeDiscount.enrolled_siblings !== 1 ? 's' : ''} en la familia).`}
              </p>
            )}
          </div>
        )}

        {concepts.length > 0 && (
          <div>
            <label htmlFor="concept" className={labelClass}>Concepto (opcional — autocompleta)</label>
            <select id="concept" value={conceptId} onChange={(e) => applyConcept(e.target.value)} className={inputClass}>
              <option value="">Personalizado</option>
              {concepts.map((c) => <option key={c.id} value={c.id}>{c.name} — {formatDOP.format(c.amount)}</option>)}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="description" className={labelClass}>Descripción</label>
          <input id="description" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Mensualidad enero 2027" className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="amount" className={labelClass}>Monto (DOP)</label>
            <input id="amount" type="number" min="0" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="dueDate" className={labelClass}>Fecha límite</label>
            <DateInputES id="dueDate" required value={dueDate} onChange={setDueDate} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={applyTax} onChange={(e) => setApplyTax(e.target.checked)} className="rounded" />
          Aplicar ITBIS (18%)
        </label>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Monto base</span>
            <span>{formatDOP.format(Number(amount || 0))}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
              <span>Descuento por hermanos ({discountPercent}%)</span>
              <span>−{formatDOP.format(discountAmount)}</span>
            </div>
          )}
          {applyTax && (
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>ITBIS (18%)</span>
              <span>{formatDOP.format(taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">Total a facturar</span>
            <span className="font-black text-slate-900 dark:text-white">{formatDOP.format(totalAmount)}</span>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || families.length === 0}
          className="flex-1 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition shadow-glow disabled:opacity-60"
        >
          {saving ? 'Generando...' : 'Generar factura'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-slate-200 dark:border-slate-700 px-6 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
