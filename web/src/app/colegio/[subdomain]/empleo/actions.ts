'use server'

// Formulario PÚBLICO (sin login). Un archivo 'use server' solo exporta
// funciones async -- ni constantes ni tipos (ver AGENTS.md).
//
// Escribe con service_role a propósito: la tabla no tiene ninguna policy
// para anon, así que la única puerta de entrada es esta validación.

import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  POSITIONS, LEVELS, SCHEDULES, MARITAL, REFERRALS, LICENSE,
  MAX_FILE_BYTES, ALLOWED_FILE_EXTENSIONS,
} from '@/lib/jobs/labels'

const BUCKET = 'solicitudes-empleo'

async function schoolExists(schoolId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(schoolId)) return false
  const { data } = await createAdminClient().from('schools').select('id').eq('id', schoolId).maybeSingle()
  return !!data
}

/**
 * Paso 1 para adjuntar un archivo: devuelve un enlace firmado de subida de
 * un solo uso. El navegador sube el archivo directo a Storage, así un CV de
 * varios MB no pasa por la Server Action (límite de 1MB de Next).
 */
export async function prepareJobApplicationUpload(input: {
  schoolId: string
  kind: 'cv' | 'certificados'
  fileName: string
  size: number
}): Promise<{ ok: boolean; error?: string; path?: string; token?: string }> {
  if (!(await schoolExists(input.schoolId))) return { ok: false, error: 'Colegio no encontrado.' }
  if (input.kind !== 'cv' && input.kind !== 'certificados') return { ok: false, error: 'Archivo no válido.' }
  const ext = (input.fileName.toLowerCase().split('.').pop() ?? '')
  if (!(ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
    return { ok: false, error: 'Formato no permitido. Usa PDF, Word o una foto (JPG, PNG, HEIC).' }
  }
  if (!input.size || input.size > MAX_FILE_BYTES) return { ok: false, error: 'El archivo no puede pasar de 10 MB.' }

  const path = `${input.schoolId}/${randomUUID()}-${input.kind}.${ext}`
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { ok: false, error: 'No se pudo preparar la subida del archivo. Intenta de nuevo.' }
  return { ok: true, path: data.path, token: data.token }
}

async function fileBelongsToSchool(path: string | null, schoolId: string): Promise<boolean> {
  if (!path) return true
  if (!path.startsWith(`${schoolId}/`) || path.includes('..')) return false
  const name = path.slice(schoolId.length + 1)
  const { data } = await createAdminClient().storage.from(BUCKET).list(schoolId, { search: name, limit: 1 })
  return !!data && data.some((f) => f.name === name)
}

type Row = Record<string, string>

const pick = (list: readonly { value: string }[], v: unknown) =>
  typeof v === 'string' && list.some((i) => i.value === v) ? v : null
const pickMany = (list: readonly { value: string }[], v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && list.some((i) => i.value === x)) : []
const txt = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const rows = (v: unknown, keys: string[], maxRows: number): Row[] =>
  (Array.isArray(v) ? v : [])
    .slice(0, maxRows)
    .map((r) => Object.fromEntries(keys.map((k) => [k, txt((r as Row | null)?.[k], 200)])))
    .filter((r) => Object.values(r).some(Boolean))

/** Paso 2: guarda la solicitud (los archivos ya se subieron). */
export async function submitJobApplication(input: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  // Campo trampa invisible: un humano nunca lo llena; un robot sí.
  if (txt(input.website)) return { ok: true }

  const schoolId = txt(input.schoolId, 40)
  if (!(await schoolExists(schoolId))) return { ok: false, error: 'Colegio no encontrado.' }

  const fullName = txt(input.fullName, 150)
  const mobilePhone = txt(input.mobilePhone, 40)
  const position = pick(POSITIONS, input.position)
  const signerName = txt(input.signerName, 150)
  if (!fullName) return { ok: false, error: 'Escribe tu nombre completo.' }
  if (!mobilePhone) return { ok: false, error: 'Escribe tu teléfono móvil.' }
  if (!position) return { ok: false, error: 'Marca el puesto al que te postulas.' }
  if (input.declarationAccepted !== true || !signerName) {
    return { ok: false, error: 'Acepta la declaración y escribe tu nombre como firma.' }
  }

  const cvPath = txt(input.cvPath, 200) || null
  const certificatesPath = txt(input.certificatesPath, 200) || null
  if (!(await fileBelongsToSchool(cvPath, schoolId)) || !(await fileBelongsToSchool(certificatesPath, schoolId))) {
    return { ok: false, error: 'No se encontró el archivo adjunto. Vuelve a elegirlo.' }
  }

  const birthDate = txt(input.birthDate, 10)
  const hasRelative = input.hasRelativeHere === true

  const { error } = await createAdminClient().from('job_applications').insert({
    school_id: schoolId,
    full_name: fullName,
    national_id: txt(input.nationalId, 30) || null,
    birth_date: /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? birthDate : null,
    nationality: txt(input.nationality, 60) || null,
    address: txt(input.address) || null,
    sector: txt(input.sector, 120) || null,
    mobile_phone: mobilePhone,
    home_phone: txt(input.homePhone, 40) || null,
    email: txt(input.email, 150) || null,
    marital_status: pick(MARITAL, input.maritalStatus) === 'otro'
      ? `Otro: ${txt(input.maritalOther, 60)}`
      : labelFor(MARITAL, pick(MARITAL, input.maritalStatus)),
    position,
    position_other: position === 'otro' ? txt(input.positionOther, 100) || null : null,
    levels: pickMany(LEVELS, input.levels),
    specialty: txt(input.specialty, 150) || null,
    schedule: pickMany(SCHEDULES, input.schedule),
    emergency_contacts: rows(input.emergencyContacts, ['name', 'relationship', 'phone', 'occupation'], 2),
    has_relative_here: hasRelative,
    relative_name: hasRelative ? txt(input.relativeName, 150) || null : null,
    relative_relationship: hasRelative ? txt(input.relativeRelationship, 80) || null : null,
    relative_area: hasRelative ? txt(input.relativeArea, 120) || null : null,
    referral_source: pick(REFERRALS, input.referralSource),
    referral_detail: txt(input.referralDetail, 200) || null,
    education: rows(input.education, ['level', 'title', 'institution', 'year'], 3).filter((r) => r.title || r.institution),
    teaching_license: pick(LICENSE, input.teachingLicense),
    experience: rows(input.experience, ['institution', 'role', 'from', 'to', 'exitReason', 'referencePhone'], 2),
    declaration_accepted: true,
    signer_name: signerName,
    cv_path: cvPath,
    certificates_path: certificatesPath,
  })
  if (error) {
    console.error('[solicitud de empleo]', error)
    return { ok: false, error: 'No se pudo enviar tu solicitud. Intenta de nuevo o llama al colegio.' }
  }
  return { ok: true }
}

function labelFor(list: readonly { value: string; label: string }[], v: string | null): string | null {
  return v ? list.find((i) => i.value === v)?.label ?? null : null
}
