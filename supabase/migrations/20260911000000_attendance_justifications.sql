-- =========================================================================
-- MentorIApp — Justificación de ausencias por la familia
--
-- Qué resuelve: cuando un estudiante falta, el colegio ya avisa al tutor
-- (trigger notify_attendance_webhook + Edge Function notify-attendance).
-- Lo que no existía era el camino de vuelta: el tutor tenía que justificar
-- la ausencia por WhatsApp, en persona o mandando una foto del certificado
-- médico por fuera de la plataforma -- sin que quedara registro asociado a
-- la falta, y sin que nadie pudiera revisarlo después.
--
-- Esta tabla es la bandeja de esa justificación, con el MISMO patrón que ya
-- usa payment_receipts (migración 20260728010000): la familia sube su
-- versión, nunca cambia el estado de la asistencia por su cuenta, y el
-- personal del colegio confirma o rechaza. Solo al ACEPTAR se marca la fila
-- de `attendance` como 'justificado' (valor que ya existía en el check de
-- esa columna desde la migración 20260702000000 -- esta es la primera vez
-- que algo lo escribe de verdad).
--
-- Documento adjunto (certificado médico, carta, etc.): OPCIONAL. Muchas
-- justificaciones son de una línea ("amaneció con fiebre") y obligar a
-- adjuntar algo dejaría a esas familias sin poder justificar.
--
-- Alcance de quién revisa: el mismo conjunto que puede pasar lista
-- (attendance_staff_all) -- dirección/administración/recepción sin
-- restricción, y el profesor SOLO en los grados que tiene asignados. No se
-- creó un módulo nuevo en permissions.ts a propósito: quien marca la falta
-- es quien puede revisar su justificación.
--
-- OJO (trampa ya documentada en AGENTS.md, costó un día de clases el
-- 2026-09-03): teacher_is_assigned_to_grade() tiene dos sobrecargas, así
-- que TODA llamada nueva va con 3 argumentos explícitos ('regular') o
-- Postgres falla con 42725 "is not unique". La categoría es 'regular'
-- porque es la única con la que se cargaron las asignaciones reales -- usar
-- 'ingles' dejaría fuera a las docentes de esa área.
-- =========================================================================

create table if not exists attendance_justifications (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    attendance_id uuid not null references attendance(id) on delete cascade,
    student_id uuid not null references students(id),
    family_id uuid not null references families(id),
    guardian_id uuid not null references guardians(id),
    -- El motivo que escribe el tutor. Obligatorio: un archivo suelto sin
    -- explicación no le sirve a quien revisa.
    reason text not null check (length(btrim(reason)) > 0),
    -- Ruta en el bucket privado 'justificantes-ausencia'. NULL = el tutor
    -- justificó solo con texto, que es un caso normal, no un error.
    document_path text,
    document_type text,
    status text not null default 'pendiente'
        check (status in ('pendiente', 'aceptada', 'rechazada')),
    reviewed_by uuid references users_profiles(id),
    reviewed_at timestamptz,
    review_note text,
    created_at timestamptz not null default now()
);

create index if not exists idx_att_just_school_status
    on attendance_justifications(school_id, status);
create index if not exists idx_att_just_attendance
    on attendance_justifications(attendance_id);
create index if not exists idx_att_just_student
    on attendance_justifications(student_id);

-- Una sola justificación viva por falta: si ya hay una pendiente o aceptada,
-- no se puede mandar otra. Rechazada sí deja volver a intentar (el colegio
-- puede pedir el certificado médico que faltaba).
create unique index if not exists idx_att_just_una_viva_por_falta
    on attendance_justifications(attendance_id)
    where status <> 'rechazada';

alter table attendance_justifications enable row level security;

-- ── Tutor: ve y crea las justificaciones de SUS hijos ────────────────────
-- Se autoriza por el vínculo real (student_guardians -> guardians ->
-- users_profiles.guardian_id), NO por `role = 'guardian'`: personal del
-- colegio que además es padre/madre aquí (doble rol) tiene que poder
-- justificar la falta de su propio hijo desde su Vista de Familia. Ese
-- filtro de más fue justo el bug que la migración 20260821060000 tuvo que
-- corregir en 24 policies.
drop policy if exists "attendance_justifications_guardian_read" on attendance_justifications;
create policy "attendance_justifications_guardian_read" on attendance_justifications
for select using (
    student_id in (
        select sg.student_id from student_guardians sg
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
);

drop policy if exists "attendance_justifications_guardian_insert" on attendance_justifications;
create policy "attendance_justifications_guardian_insert" on attendance_justifications
for insert with check (
    guardian_id in (
        select g.id from guardians g
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
    and student_id in (
        select sg.student_id from student_guardians sg
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
    -- El tutor nunca crea nada ya revisado.
    and status = 'pendiente'
);

-- Sin policy de update/delete para el tutor: una vez enviada, solo el
-- colegio cambia el estado (mismo criterio que payment_receipts).

-- ── Personal: mismo alcance que pasar lista ──────────────────────────────
drop policy if exists "attendance_justifications_staff_read" on attendance_justifications;
create policy "attendance_justifications_staff_read" on attendance_justifications
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin', 'school_admin', 'director', 'reception')
    )
    or (
        school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
        and exists (
            select 1 from students s
            where s.id = attendance_justifications.student_id
              and s.grade_level is not null
              and teacher_is_assigned_to_grade(s.school_id, s.grade_level, 'regular')
        )
    )
);

drop policy if exists "attendance_justifications_staff_update" on attendance_justifications;
create policy "attendance_justifications_staff_update" on attendance_justifications
for update using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin', 'school_admin', 'director', 'reception')
    )
    or (
        school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
        and exists (
            select 1 from students s
            where s.id = attendance_justifications.student_id
              and s.grade_level is not null
              and teacher_is_assigned_to_grade(s.school_id, s.grade_level, 'regular')
        )
    )
) with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin', 'school_admin', 'director', 'reception')
    )
    or (
        school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
        and exists (
            select 1 from students s
            where s.id = attendance_justifications.student_id
              and s.grade_level is not null
              and teacher_is_assigned_to_grade(s.school_id, s.grade_level, 'regular')
        )
    )
);

-- ── Grants para la Data API ──────────────────────────────────────────────
-- Supabase NO expone automáticamente las tablas nuevas: sin esto, la Data
-- API responde "permission denied for table" aunque la RLS sea correcta
-- (ver migración 20260702210000, que tuvo que enumerar tabla por tabla).
-- Sin delete: una justificación enviada no se borra, se rechaza.
grant select, insert, update on attendance_justifications to authenticated;
grant all privileges on attendance_justifications to service_role;

-- ── Storage: documentos de justificación (bucket privado) ────────────────
-- Igual que 'comprobantes-pago' y 'class-updates': a propósito SIN ninguna
-- política de storage.objects para anon/authenticated. Toda subida y toda
-- lectura pasa por Server Actions que usan service_role después de validar
-- el permiso en TypeScript, y las lecturas son signed URLs de 5 minutos --
-- nunca una URL pública. Aquí importa más que en pagos: un certificado
-- médico de un menor es dato de salud.
insert into storage.buckets (id, name, public)
values ('justificantes-ausencia', 'justificantes-ausencia', false)
on conflict (id) do nothing;
