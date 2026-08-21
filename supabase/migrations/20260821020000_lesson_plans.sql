-- =========================================================================
-- MentorIApp — Planificación de clases (3/4, inspirado en TokApp iEduca)
--
-- Cada fila es el plan de UNA clase puntual: qué franja del horario
-- (class_schedules -- ya sabe materia/grado/profesor) y en qué fecha
-- calendario. Un profesor planifica solo sus propias clases (el dueño se
-- determina por schedule.staff_id, no hay columna redundante de dueño
-- aquí); dirección/admin puede ver y editar cualquier planificación del
-- colegio, para supervisar.
--
-- No es una herramienta de cara a las familias -- a diferencia de Agenda
-- y Horarios, ningún guardian/estudiante tiene RLS de lectura aquí.
-- =========================================================================

create table if not exists lesson_plans (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    schedule_id uuid not null references class_schedules(id) on delete cascade,
    plan_date date not null,
    topic text not null,
    objective text,
    activities text,
    materials text,
    homework text,
    created_by uuid not null references users_profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (schedule_id, plan_date)
);
create index if not exists idx_lesson_plans_schedule_date on lesson_plans(schedule_id, plan_date);
create index if not exists idx_lesson_plans_school_date on lesson_plans(school_id, plan_date);

alter table lesson_plans enable row level security;

drop policy if exists "lesson_plans_admin_manage" on lesson_plans;
create policy "lesson_plans_admin_manage" on lesson_plans
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
) with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director')
    )
);

-- Profesor: gestiona solo los planes de las franjas donde ÉL es el
-- profesor asignado en class_schedules.
drop policy if exists "lesson_plans_teacher_own" on lesson_plans;
create policy "lesson_plans_teacher_own" on lesson_plans
for all using (
    school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
    and schedule_id in (
        select cs.id from class_schedules cs
        join users_profiles up on up.staff_id = cs.staff_id
        where up.auth_id = auth.uid()
    )
) with check (
    school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
    and schedule_id in (
        select cs.id from class_schedules cs
        join users_profiles up on up.staff_id = cs.staff_id
        where up.auth_id = auth.uid()
    )
);

grant select, insert, update, delete on lesson_plans to authenticated;
grant all privileges on lesson_plans to service_role;
