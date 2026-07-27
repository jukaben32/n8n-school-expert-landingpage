'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const inputClass =
  'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 transition focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
const labelClass = 'block text-xs font-mono uppercase tracking-wider text-white/50 mb-1.5'

export default function LeadForm() {
  const [status, setStatus] = useState<'idle' | 'saving' | 'sent' | 'error'>('idle')
  const [sentEmail, setSentEmail] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // Se lee del DOM en vez de solo el estado de React: cuando el
    // navegador autocompleta un campo, a veces rellena el valor
    // visualmente sin disparar el evento onChange -- si dependiéramos
    // solo del estado, el formulario se vería lleno pero React seguiría
    // pensando que está vacío. FormData siempre refleja lo que hay
    // realmente en el formulario al momento de enviar.
    const formData = new FormData(e.currentTarget)
    const schoolName = String(formData.get('schoolName') ?? '').trim()
    const contactName = String(formData.get('contactName') ?? '').trim()
    const email = String(formData.get('email') ?? '').trim()
    const roleTitle = String(formData.get('roleTitle') ?? '').trim()
    const phone = String(formData.get('phone') ?? '').trim()
    const studentCount = String(formData.get('studentCount') ?? '').trim()
    const interest = String(formData.get('interest') ?? '').trim()
    const message = String(formData.get('message') ?? '').trim()

    if (!schoolName || !contactName || !email) {
      setStatus('error')
      return
    }

    setStatus('saving')
    const supabase = createClient()
    const { error } = await supabase.from('leads').insert({
      school_name: schoolName,
      contact_name: contactName,
      role_title: roleTitle || null,
      email,
      phone: phone || null,
      student_count: studentCount || null,
      interest: interest || null,
      message: message || null,
    })
    setSentEmail(email)
    setStatus(error ? 'error' : 'sent')
  }

  if (status === 'sent') {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center space-y-3">
        <p className="text-4xl" aria-hidden="true">✅</p>
        <p className="font-display text-xl text-white">Solicitud recibida</p>
        <p className="text-sm text-white/60">
          Te escribimos a <strong className="text-white/90">{sentEmail}</strong> en las próximas 24 horas para coordinar la demo.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="schoolName" className={labelClass}>Nombre del colegio</label>
          <input id="schoolName" name="schoolName" required className={inputClass} placeholder="Colegio San Rafael" />
        </div>
        <div>
          <label htmlFor="contactName" className={labelClass}>Tu nombre</label>
          <input id="contactName" name="contactName" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="roleTitle" className={labelClass}>Tu cargo</label>
          <input id="roleTitle" name="roleTitle" className={inputClass} placeholder="Directora, Secretaria..." />
        </div>
        <div>
          <label htmlFor="studentCount" className={labelClass}>Cantidad de estudiantes</label>
          <select id="studentCount" name="studentCount" defaultValue="" className={inputClass}>
            <option value="" className="text-slate-900">Selecciona un rango</option>
            <option value="menos de 100" className="text-slate-900">Menos de 100</option>
            <option value="100-300" className="text-slate-900">100–300</option>
            <option value="300-800" className="text-slate-900">300–800</option>
            <option value="más de 800" className="text-slate-900">Más de 800</option>
          </select>
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>Correo</label>
          <input id="email" name="email" type="email" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>Teléfono</label>
          <input id="phone" name="phone" className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="interest" className={labelClass}>Qué te interesa más</label>
        <select id="interest" name="interest" defaultValue="" className={inputClass}>
          <option value="" className="text-slate-900">Selecciona una opción</option>
          <option value="Estudiantes y familias" className="text-slate-900">Estudiantes y familias</option>
          <option value="Tesorería y pagos" className="text-slate-900">Tesorería y pagos</option>
          <option value="Comunicados y asistencia" className="text-slate-900">Comunicados y asistencia</option>
          <option value="Academia (video-lecciones)" className="text-slate-900">Academia (video-lecciones)</option>
          <option value="Todo el sistema" className="text-slate-900">Todo el sistema</option>
        </select>
      </div>

      <div>
        <label htmlFor="message" className={labelClass}>Cuéntanos de tu colegio (opcional)</label>
        <textarea id="message" name="message" rows={3} className={`${inputClass} resize-none`} />
      </div>

      {status === 'error' && (
        <p role="alert" className="text-sm text-coral">
          Completa al menos el colegio, tu nombre y tu correo. Si ya lo hiciste, intenta de nuevo en un momento.
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'saving'}
        className="w-full rounded-full bg-coral hover:brightness-110 text-white font-semibold py-3.5 text-sm transition shadow-glow disabled:opacity-60"
      >
        {status === 'saving' ? 'Enviando...' : 'Solicitar demo'}
      </button>
      <p className="text-center text-xs text-white/40">Sin compromiso. Te respondemos en menos de 24 horas.</p>
    </form>
  )
}
