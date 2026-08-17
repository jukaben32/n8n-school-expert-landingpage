'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-offset-0'

export default function InquiryForm({ schoolId, primaryColor }: { schoolId: string; primaryColor: string }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim() || (!phone.trim() && !email.trim())) {
      setError('Escribe tu nombre y al menos un teléfono o correo.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/website/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, name: name.trim(), phone: phone.trim(), email: email.trim(), message: message.trim() }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setError(payload?.error || 'No se pudo enviar tu mensaje. Intenta de nuevo.')
        return
      }
      setSubmitted(true)
      setName('')
      setPhone('')
      setEmail('')
      setMessage('')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
        <CheckCircle2 className="mx-auto w-10 h-10" style={{ color: primaryColor }} />
        <p className="mt-4 font-bold text-slate-900">¡Gracias por escribirnos!</p>
        <p className="mt-1.5 text-sm text-slate-500">El colegio se pondrá en contacto contigo pronto.</p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-5 text-sm font-semibold underline"
          style={{ color: primaryColor }}
        >
          Enviar otro mensaje
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-100 bg-white p-6 space-y-3.5 text-left shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
    >
      <p className="font-bold text-slate-900">¿Te interesa inscribir a tu hijo/a?</p>
      <p className="text-xs text-slate-500 -mt-2">Déjanos tus datos y el colegio te contacta.</p>
      <input placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input placeholder="Teléfono / WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        <input type="email" placeholder="Correo (opcional)" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </div>
      <textarea
        placeholder="¿En qué podemos ayudarte?"
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className={inputClass}
      />
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full text-white font-semibold px-6 py-3 text-sm transition disabled:opacity-60"
        style={{ backgroundColor: primaryColor }}
      >
        {submitting ? 'Enviando…' : 'Enviar mensaje'}
      </button>
    </form>
  )
}
