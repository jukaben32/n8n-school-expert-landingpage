-- =========================================================================
-- MENTORIAPP — Autorregistro de personal (formulario público) + revisión
--
-- El usuario quiere compartir un enlace por WhatsApp para que cada
-- empleado (30+ personas de Gran Manantial de Sabiduría) complete sus
-- propios datos -- perfil profesional y correo -- en vez de que alguien
-- del colegio los digite uno por uno a mano.
--
-- Diseño elegido a propósito, mismo patrón ya usado para leads y fichas
-- de inscripción escaneadas: formulario PÚBLICO (sin login) que inserta en
-- una tabla de revisión, nunca directo en `staff`. El colegio revisa cada
-- envío y decide si aprobar (crea el registro real en `staff`, con opción
-- de dar acceso al sistema ahí mismo) o rechazar. Nunca se transcriben a
-- mano datos delicados (cédula, teléfono) desde ningún documento -- cada
-- persona reporta los suyos directamente, garantizado exacto porque lo
-- escribe ella misma.
-- =========================================================================

create table if not exists staff_registrations (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),

    first_name text not null,
    last_name text not null,
    email text not null,
    phone text,
    national_id text,

    desired_role text not null
        check (desired_role in (
            'director','coordinator','teacher','assistant','finance',
            'reception','nurse','admin',
            'security','janitor','cafeteria_assistant','cleaning_assistant',
            'doorman','secretary','teaching_secretary','teaching_assistant',
            'administrator','psychologist'
        )),
    specialty text, -- materia/curso/área, texto libre (ej. "Inglés (Nivel Primario) 1er Ciclo")

    -- Ficha profesional -- mismos campos que ya existen en `staff`
    education_level text
        check (education_level in ('tecnico','bachiller','licenciatura','maestria','doctorado')),
    degree_title text,
    alma_mater text,
    graduation_year int,
    certifications text,
    bio text,

    status text not null default 'pendiente'
        check (status in ('pendiente','aprobado','rechazado')),
    reviewed_by uuid references users_profiles(id),
    reviewed_at timestamptz,
    rejection_reason text,
    created_staff_id uuid references staff(id),

    created_at timestamptz not null default now()
);

create index if not exists idx_staff_registrations_school_status on staff_registrations(school_id, status);

alter table staff_registrations enable row level security;

-- Envío público -- mismo patrón que `leads` (grant explícito + policy),
-- necesario porque `anon` no tiene privilegios por defecto sobre tablas
-- nuevas.
grant insert on staff_registrations to anon, authenticated;

drop policy if exists "staff_registrations_public_insert" on staff_registrations;
create policy "staff_registrations_public_insert" on staff_registrations
for insert to anon, authenticated
with check (true);

-- Revisión: solo dirección/administración del propio colegio -- mismo
-- nivel que la gestión de Personal en sí.
drop policy if exists "staff_registrations_staff_manage" on staff_registrations;
create policy "staff_registrations_staff_manage" on staff_registrations
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director')
    )
);
