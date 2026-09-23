'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { prepareJobApplicationUpload, submitJobApplication } from './actions'
import {
  POSITIONS, LEVELS, SCHEDULES, MARITAL, REFERRALS, LICENSE, EDUCATION_LEVELS,
  MAX_FILE_BYTES, FILE_ACCEPT,
} from '@/lib/jobs/labels'

const inputClass =
  'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 transition focus:outline-none focus:ring-2 focus:ring-accent-light focus:border-transparent'
const labelClass = 'block text-sm font-medium text-white/80 mb-1.5'
const cardClass = 'rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 space-y-4'
const titleClass = 'text-base font-bold text-white'
const optionClass = 'flex items-center gap-2 text-sm text-white/80'

export default function JobApplicationForm({ schoolId }: { schoolId: string }) {
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState('')
  const [marital, setMarital] = useState('')
  const [hasRelative, setHasRelative] = useState(false)
  const [referral, setReferral] = useState('')

  async function uploadFile(file: File | null, kind: 'cv' | 'certificados'): Promise<string | null> {
    if (!file || file.size === 0) return null
    if (file.size > MAX_FILE_BYTES) throw new Error(`El archivo "${file.name}" pasa de 10 MB.`)
    const prep = await prepareJobApplicationUpload({ schoolId, kind, fileName: file.name, size: file.size })
    if (!prep.ok || !prep.path || !prep.token) throw new Error(prep.error ?? 'No se pudo subir el archivo.')
    const { error: upErr } = await createClient().storage.from('solicitudes-empleo').uploadToSignedUrl(prep.path, prep.token, file)
    if (upErr) throw new Error(`No se pudo subir "${file.name}". Revisa tu conexión e intenta de nuevo.`)
    return prep.path
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    // FormData en vez de estado controlado: el autocompletado del navegador
    // no dispara onChange (bug ya conocido en LeadForm.tsx).
    const fd = new FormData(e.currentTarget)
    const get = (k: string) => String(fd.get(k) ?? '').trim()

    if (!get('fullName') || !get('mobilePhone') || !get('position')) {
      setError('Completa al menos tu nombre, tu teléfono móvil y el puesto al que te postulas.')
      return
    }
    if (fd.get('declarationAccepted') !== 'on' || !get('signerName')) {
      setError('Para enviar, acepta la declaración y escribe tu nombre como firma.')
      return
    }

    setSaving(true)
    try {
      setStatus('Subiendo archivos...')
      const cvFile = fd.get('cv') as File | null
      const certFile = fd.get('certificados') as File | null
      const cvPath = await uploadFile(cvFile, 'cv')
      const certificatesPath = await uploadFile(certFile, 'certificados')

      setStatus('Enviando solicitud...')
      const result = await submitJobApplication({
        schoolId,
        website: get('website'),
        fullName: get('fullName'),
        nationalId: get('nationalId'),
        birthDate: get('birthDate'),
        nationality: get('nationality'),
        address: get('address'),
        sector: get('sector'),
        mobilePhone: get('mobilePhone'),
        homePhone: get('homePhone'),
        email: get('email'),
        maritalStatus: get('maritalStatus'),
        maritalOther: get('maritalOther'),
        position: get('position'),
        positionOther: get('positionOther'),
        levels: fd.getAll('levels').map(String),
        specialty: get('specialty'),
        schedule: fd.getAll('schedule').map(String),
        emergencyContacts: [0, 1].map((i) => ({
          name: get(`ec${i}_name`), relationship: get(`ec${i}_relationship`), phone: get(`ec${i}_phone`), occupation: get(`ec${i}_occupation`),
        })),
        hasRelativeHere: get('hasRelativeHere') === 'si',
        relativeName: get('relativeName'),
        relativeRelationship: get('relativeRelationship'),
        relativeArea: get('relativeArea'),
        referralSource: get('referralSource'),
        referralDetail: get('referralDetail'),
        education: EDUCATION_LEVELS.map((level, i) => ({
          level, title: get(`ed${i}_title`), institution: get(`ed${i}_institution`), year: get(`ed${i}_year`),
        })),
        teachingLicense: get('teachingLicense'),
        experience: [0, 1].map((i) => ({
          institution: get(`ex${i}_institution`), role: get(`ex${i}_role`), from: get(`ex${i}_from`), to: get(`ex${i}_to`),
          exitReason: get(`ex${i}_exitReason`), referencePhone: get(`ex${i}_referencePhone`),
        })),
        declarationAccepted: true,
        signerName: get('signerName'),
        cvPath,
        certificatesPath,
      })
      if (!result.ok) {
        setError(result.error ?? 'No se pudo enviar tu solicitud.')
        return
      }
      setSubmitted(true)
      window.scrollTo({ top: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar. Revisa tu conexión y vuelve a intentarlo.')
    } finally {
      setSaving(false)
      setStatus(null)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-3xl mb-3" aria-hidden="true">✓</p>
        <p className="text-white font-semibold">¡Solicitud enviada!</p>
        <p className="text-white/60 text-sm mt-1.5">
          Gracias por tu interés. La dirección del colegio revisará tu solicitud y se comunicará contigo si tu perfil
          se ajusta a una vacante.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Campo trampa para robots: oculto para las personas. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className={cardClass}>
        <p className={titleClass}>1. Datos personales</p>
        <div>
          <label htmlFor="fullName" className={labelClass}>Nombre(s) y apellidos *</label>
          <input id="fullName" name="fullName" required autoComplete="name" className={inputClass} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nationalId" className={labelClass}>Cédula / Documento de identidad</label>
            <input id="nationalId" name="nationalId" inputMode="numeric" placeholder="000-0000000-0" className={inputClass} />
          </div>
          <div>
            <label htmlFor="birthDate" className={labelClass}>Fecha de nacimiento</label>
            <input id="birthDate" name="birthDate" type="date" className={inputClass} />
          </div>
          <div>
            <label htmlFor="nationality" className={labelClass}>Nacionalidad</label>
            <input id="nationality" name="nationality" className={inputClass} />
          </div>
          <div>
            <label htmlFor="sector" className={labelClass}>Sector / Municipio</label>
            <input id="sector" name="sector" className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor="address" className={labelClass}>Dirección de residencia</label>
          <input id="address" name="address" autoComplete="street-address" className={inputClass} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="mobilePhone" className={labelClass}>Teléfono móvil *</label>
            <input id="mobilePhone" name="mobilePhone" type="tel" required autoComplete="tel" className={inputClass} />
          </div>
          <div>
            <label htmlFor="homePhone" className={labelClass}>Teléfono residencial</label>
            <input id="homePhone" name="homePhone" type="tel" className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>Correo electrónico</label>
          <input id="email" name="email" type="email" autoComplete="email" className={inputClass} />
        </div>
        <div>
          <p className={labelClass}>Estado civil</p>
          <div className="flex flex-wrap gap-4">
            {MARITAL.map((m) => (
              <label key={m.value} className={optionClass}>
                <input type="radio" name="maritalStatus" value={m.value} onChange={() => setMarital(m.value)} /> {m.label}
              </label>
            ))}
          </div>
          {marital === 'otro' && <input name="maritalOther" placeholder="Especifique" className={`${inputClass} mt-2`} />}
        </div>
      </div>

      <div className={cardClass}>
        <p className={titleClass}>2. Posición a la que postula</p>
        <div>
          <p className={labelClass}>Puesto *</p>
          <div className="flex flex-wrap gap-4">
            {POSITIONS.map((p) => (
              <label key={p.value} className={optionClass}>
                <input type="radio" name="position" value={p.value} required onChange={() => setPosition(p.value)} /> {p.label}
              </label>
            ))}
          </div>
          {position === 'otro' && <input name="positionOther" placeholder="¿Cuál puesto?" className={`${inputClass} mt-2`} />}
        </div>
        <div>
          <p className={labelClass}>Nivel de interés (si aplica)</p>
          <div className="flex flex-wrap gap-4">
            {LEVELS.map((l) => (
              <label key={l.value} className={optionClass}>
                <input type="checkbox" name="levels" value={l.value} /> {l.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="specialty" className={labelClass}>Área / asignatura de especialidad (Secundaria)</label>
          <input id="specialty" name="specialty" className={inputClass} />
        </div>
        <div>
          <p className={labelClass}>Disponibilidad de horario</p>
          <div className="flex flex-wrap gap-4">
            {SCHEDULES.map((s) => (
              <label key={s.value} className={optionClass}>
                <input type="checkbox" name="schedule" value={s.value} /> {s.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <p className={titleClass}>3. Contactos familiares y de emergencia</p>
        <p className="text-white/60 text-sm">Dos familiares cercanos a quienes contactar en caso de emergencia.</p>
        {[0, 1].map((i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-2 rounded-xl border border-white/10 p-4">
            <input name={`ec${i}_name`} placeholder={`Familiar ${i + 1}: nombre completo`} className={`${inputClass} sm:col-span-2`} />
            <input name={`ec${i}_relationship`} placeholder="Parentesco" className={inputClass} />
            <input name={`ec${i}_phone`} type="tel" placeholder="Teléfono" className={inputClass} />
            <input name={`ec${i}_occupation`} placeholder="Ocupación / lugar de trabajo" className={`${inputClass} sm:col-span-2`} />
          </div>
        ))}
      </div>

      <div className={cardClass}>
        <p className={titleClass}>4. Vinculación institucional y referencia</p>
        <div>
          <p className={labelClass}>¿Tiene pareja, cónyuge o familiar trabajando actualmente en nuestra institución?</p>
          <div className="flex gap-4">
            <label className={optionClass}><input type="radio" name="hasRelativeHere" value="no" onChange={() => setHasRelative(false)} /> No</label>
            <label className={optionClass}><input type="radio" name="hasRelativeHere" value="si" onChange={() => setHasRelative(true)} /> Sí</label>
          </div>
        </div>
        {hasRelative && (
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="relativeName" placeholder="Nombre del colaborador" className={`${inputClass} sm:col-span-2`} />
            <input name="relativeRelationship" placeholder="Parentesco / relación" className={inputClass} />
            <input name="relativeArea" placeholder="Puesto o área donde labora" className={inputClass} />
          </div>
        )}
        <div>
          <p className={labelClass}>¿Cómo conoció nuestra institución y esta oportunidad?</p>
          <div className="space-y-2">
            {REFERRALS.map((r) => (
              <label key={r.value} className={optionClass}>
                <input type="radio" name="referralSource" value={r.value} onChange={() => setReferral(r.value)} /> {r.label}
              </label>
            ))}
          </div>
          {(referral === 'empleado' || referral === 'otro') && (
            <input
              name="referralDetail"
              placeholder={referral === 'empleado' ? 'Nombre del empleado que le recomendó' : 'Especifique'}
              className={`${inputClass} mt-2`}
            />
          )}
        </div>
      </div>

      <div className={cardClass}>
        <p className={titleClass}>5. Formación académica</p>
        {EDUCATION_LEVELS.map((level, i) => (
          <div key={level} className="grid gap-3 sm:grid-cols-3 rounded-xl border border-white/10 p-4">
            <p className="text-sm font-semibold text-white/80 sm:col-span-3">{level}</p>
            <input name={`ed${i}_title`} placeholder="Título obtenido" className={inputClass} />
            <input name={`ed${i}_institution`} placeholder="Institución / universidad" className={inputClass} />
            <input name={`ed${i}_year`} inputMode="numeric" placeholder="Año de graduación" className={inputClass} />
          </div>
        ))}
        <div>
          <p className={labelClass}>¿Posee carnet o licencia del Ministerio de Educación / habilitación docente?</p>
          <div className="flex gap-4">
            {LICENSE.map((l) => (
              <label key={l.value} className={optionClass}>
                <input type="radio" name="teachingLicense" value={l.value} /> {l.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <p className={titleClass}>6. Experiencia laboral reciente</p>
        <p className="text-white/60 text-sm">Comience por el último empleo o el actual.</p>
        {[0, 1].map((i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-2 rounded-xl border border-white/10 p-4">
            <input name={`ex${i}_institution`} placeholder="Institución / colegio" className={`${inputClass} sm:col-span-2`} />
            <input name={`ex${i}_role`} placeholder="Cargo desempeñado / grado impartido" className={`${inputClass} sm:col-span-2`} />
            <div>
              <label className="block text-xs text-white/60 mb-1">Desde</label>
              <input name={`ex${i}_from`} type="month" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Hasta</label>
              <input name={`ex${i}_to`} type="month" className={inputClass} />
            </div>
            <input name={`ex${i}_exitReason`} placeholder="Motivo de salida" className={inputClass} />
            <input name={`ex${i}_referencePhone`} type="tel" placeholder="Teléfono para referencia" className={inputClass} />
          </div>
        ))}
      </div>

      <div className={cardClass}>
        <p className={titleClass}>Documentos</p>
        <div>
          <label htmlFor="cv" className={labelClass}>Currículum (CV) actualizado</label>
          <input id="cv" name="cv" type="file" accept={FILE_ACCEPT} className="block w-full text-sm text-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white" />
        </div>
        <div>
          <label htmlFor="certificados" className={labelClass}>Certificaciones académicas (un PDF o una foto)</label>
          <input id="certificados" name="certificados" type="file" accept={FILE_ACCEPT} className="block w-full text-sm text-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white" />
        </div>
        <p className="text-xs text-white/50">PDF, Word o foto (JPG, PNG, HEIC). Máximo 10 MB por archivo.</p>
      </div>

      <div className={cardClass}>
        <p className={titleClass}>7. Declaración y firma</p>
        <label className="flex items-start gap-2 text-sm text-white/80">
          <input type="checkbox" name="declarationAccepted" className="mt-1" required />
          <span>
            Declaro bajo fe de juramento que toda la información suministrada en esta solicitud es verídica, completa y
            correcta. Autorizo a la institución a verificar la autenticidad de los datos, referencias personales y
            laborales proporcionadas.
          </span>
        </label>
        <div>
          <label htmlFor="signerName" className={labelClass}>Escriba su nombre completo como firma *</label>
          <input id="signerName" name="signerName" required className={inputClass} />
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition shadow-glow disabled:opacity-60"
      >
        {saving ? status ?? 'Enviando...' : 'Enviar solicitud'}
      </button>
    </form>
  )
}
