-- =========================================================================
-- MentorIApp — Autorizaciones (permisos firmados para excursiones, etc.)
--
-- Reemplaza el papel que el tutor firmaba y devolvía físicamente. Cada
-- autorización se dirige a todo el colegio o a un curso (mismo modelo de
-- grade_level texto libre que Agenda/Comunicados/class_updates). Cada
-- estudiante en esa audiencia necesita su propia respuesta -- un tutor
-- puede tener más de un hijo en el mismo curso, y cada uno necesita
-- autorización explícita.
--
-- `description` se guarda TAL CUAL en cada respuesta (authorization_responses.
-- No hay: la campaña se puede editar después, pero la constancia legal debe
-- reflejar exactamente qué se autorizó en el momento de la firma, no lo que
-- diga hoy authorization_requests si alguien lo cambió después.
-- =========================================================================

create table if not exists authorization_requests (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    title text not null,
    description text not null,
    event_date date,
    grade_level text, -- null = todo el colegio
    created_by uuid not null references users_profiles(id),
    created_at timestamptz not null default now(),
    closed_at timestamptz
);
create index if not exists idx_authorization_requests_school on authorization_requests(school_id, created_at desc);

alter table authorization_requests enable row level security;

drop policy if exists "authorization_requests_staff_manage" on authorization_requests;
create policy "authorization_requests_staff_manage" on authorization_requests
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director', 'teacher', 'reception')
    )
) with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director', 'teacher', 'reception')
    )
);

drop policy if exists "authorization_requests_guardian_read" on authorization_requests;
create policy "authorization_requests_guardian_read" on authorization_requests
for select using (
    grade_level is null
    or grade_level in (
        select s.grade_level from students s
        join student_guardians sg on sg.student_id = s.id
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
);

grant select, insert, update, delete on authorization_requests to authenticated;
grant all privileges on authorization_requests to service_role;

-- Cédula/nombre/decisión "congelados" en el momento de firmar -- es la
-- constancia legal, no debe cambiar si el tutor edita su perfil después.
create table if not exists authorization_responses (
    id uuid primary key default gen_random_uuid(),
    authorization_request_id uuid not null references authorization_requests(id) on delete cascade,
    student_id uuid not null references students(id) on delete cascade,
    guardian_id uuid not null references guardians(id),
    decision text not null check (decision in ('autorizado', 'no_autorizado')),
    signer_full_name text not null,
    responded_at timestamptz not null default now(),
    unique (authorization_request_id, student_id)
);
create index if not exists idx_authorization_responses_request on authorization_responses(authorization_request_id);

alter table authorization_responses enable row level security;

-- Staff: solo lectura (el panel consolidado) -- no editan la firma de nadie.
drop policy if exists "authorization_responses_staff_read" on authorization_responses;
create policy "authorization_responses_staff_read" on authorization_responses
for select using (
    authorization_request_id in (
        select ar.id from authorization_requests ar
        join users_profiles up on up.school_id = ar.school_id
        where up.auth_id = auth.uid() and up.role in ('super_admin', 'school_admin', 'director', 'teacher', 'reception')
    )
);

-- Tutor: gestiona (crea/actualiza) solo la respuesta de SUS propios hijos,
-- y solo con su propio guardian_id como firmante -- nunca puede firmar en
-- nombre de otro tutor ni de un estudiante que no sea suyo.
drop policy if exists "authorization_responses_guardian_own" on authorization_responses;
create policy "authorization_responses_guardian_own" on authorization_responses
for all using (
    guardian_id in (select guardian_id from users_profiles where auth_id = auth.uid() and role = 'guardian')
    and student_id in (
        select sg.student_id from student_guardians sg
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
) with check (
    guardian_id in (select guardian_id from users_profiles where auth_id = auth.uid() and role = 'guardian')
    and student_id in (
        select sg.student_id from student_guardians sg
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
);

grant select, insert, update on authorization_responses to authenticated;
grant all privileges on authorization_responses to service_role;
