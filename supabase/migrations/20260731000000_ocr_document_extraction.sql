-- =========================================================================
-- SCHOOLOS — Migración 024: Extracción OCR estructurada con Claude (visión)
--
-- Dos casos de uso, un solo núcleo compartido en código
-- (web/src/lib/ocr/extractStructuredDocument.ts, ver AGENTS.md):
--   1. Fichas físicas de inscripción de estudiantes (URGENTE -- inicio de
--      clases en ~2 semanas) -- reception/director/school_admin/super_admin.
--   2. Facturas de proveedores -> Alegra -- finance/director/school_admin/
--      super_admin (mismo set de roles que ya tiene acceso al módulo
--      'tesoreria' en web/src/lib/permissions.ts).
--
-- Regla de seguridad no negociable en ambos casos: la extracción de Claude
-- NUNCA crea el registro final por sí sola. Estas tablas son la bandeja de
-- revisión -- solo guardan lo que Claude leyó (extracted_data, jsonb, de
-- solo auditoría) hasta que un humano confirma o rechaza. La confirmación
-- crea el estudiante/familia o aprueba la factura con los valores que el
-- staff haya corregido en pantalla, no ciegamente con extracted_data.
-- =========================================================================

-- ── Campos de la ficha física que no tenían columna todavía ──────────────
-- La ficha física pide más datos de los que el formulario manual de alta
-- capturaba hasta ahora. emergency_contact y medical_notes YA existían
-- (jsonb) -- se reutilizan tal cual. matricula ya existía como
-- students.student_code. Lo que faltaba:
alter table students add column if not exists birth_place text;
alter table students add column if not exists grade_level text; -- "curso" escrito en la ficha, texto libre (no depende de academic_structure)
alter table guardians add column if not exists national_id text;   -- cédula
alter table guardians add column if not exists address text;       -- dirección
alter table guardians add column if not exists origin_province text;
alter table guardians add column if not exists nationality text;

-- ── Fichas de inscripción escaneadas ─────────────────────────────────────
create table if not exists enrollment_form_scans (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    uploaded_by uuid not null references users_profiles(id),
    storage_path text not null,
    -- Número de página (1-indexado) cuando storage_path apunta a un PDF
    -- multi-página subido en lote -- null cuando storage_path es un
    -- archivo suelto que ES la ficha completa.
    source_page integer,
    status text not null default 'pendiente'
        check (status in ('pendiente', 'confirmado', 'rechazado')),
    extracted_data jsonb,
    confidence numeric(3,2),
    extraction_error text,
    created_student_id uuid references students(id),
    created_family_id uuid references families(id),
    reviewed_by uuid references users_profiles(id),
    reviewed_at timestamptz,
    rejection_reason text,
    created_at timestamptz not null default now()
);

create index if not exists idx_enrollment_form_scans_school_status on enrollment_form_scans(school_id, status);

alter table enrollment_form_scans enable row level security;

-- Solo el staff que ya puede dar de alta estudiantes (mismo set de roles
-- que el módulo 'estudiantes_nuevo' en permissions.ts, más 'reception' que
-- ya estaba incluido ahí) -- ningún guardian tiene acceso a esta tabla.
drop policy if exists "enrollment_form_scans_staff_all" on enrollment_form_scans;
create policy "enrollment_form_scans_staff_all" on enrollment_form_scans
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin', 'school_admin', 'director', 'reception')
    )
) with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin', 'school_admin', 'director', 'reception')
    )
);

-- ── Facturas de proveedores escaneadas ───────────────────────────────────
create table if not exists vendor_invoices (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    uploaded_by uuid not null references users_profiles(id),
    storage_path text not null,
    source_page integer,
    status text not null default 'pendiente'
        check (status in ('pendiente', 'aprobado', 'rechazado')),
    extracted_data jsonb,
    confidence numeric(3,2),
    extraction_error text,
    alegra_sync_status text not null default 'no_intentado'
        check (alegra_sync_status in ('no_intentado', 'sincronizado', 'error')),
    alegra_bill_id text,
    alegra_sync_error text,
    reviewed_by uuid references users_profiles(id),
    reviewed_at timestamptz,
    rejection_reason text,
    created_at timestamptz not null default now()
);

create index if not exists idx_vendor_invoices_school_status on vendor_invoices(school_id, status);

alter table vendor_invoices enable row level security;

-- Mismo set de roles que ya puede acceder al módulo 'tesoreria' en
-- permissions.ts (finance/director/school_admin/super_admin) -- reception
-- y teacher no tienen acceso, igual que al resto de Tesorería.
drop policy if exists "vendor_invoices_staff_all" on vendor_invoices;
create policy "vendor_invoices_staff_all" on vendor_invoices
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin', 'school_admin', 'director', 'finance')
    )
) with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin', 'school_admin', 'director', 'finance')
    )
);

-- ── Storage: buckets privados ────────────────────────────────────────────
-- A propósito, sin políticas de storage.objects para anon/authenticated --
-- mismo principio de defensa en profundidad que 'comprobantes-pago'
-- (migración 021): TODO el acceso (subida, lectura vía signed URL) pasa por
-- Server Actions con el cliente service_role, después de validar el
-- permiso explícitamente en TypeScript.
insert into storage.buckets (id, name, public)
values ('fichas-inscripcion', 'fichas-inscripcion', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('facturas-proveedores', 'facturas-proveedores', false)
on conflict (id) do nothing;
