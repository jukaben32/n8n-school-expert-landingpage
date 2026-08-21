-- =========================================================================
-- MentorIApp — Horarios (2/4, inspirado en TokApp iEduca)
--
-- class_periods: las franjas horarias del día, una sola vez para todo el
-- colegio (ej. "Período 1: 8:00-8:45", "Recreo: 9:30-9:50"), reutilizadas
-- por todos los grados.
--
-- class_schedules: qué materia y profesor tiene cada grado/sección, en
-- cada día de la semana, en cada franja. grade_level es texto libre
-- (mismo campo que students.grade_level) -- no el catálogo
-- grade_levels/enrollments de Academia, que nunca se pobló (ver
-- AGENTS.md). subject_id sí reutiliza el catálogo `subjects` existente
-- (solo nombres, no está ligado al lío de los dos sistemas de grado).
-- staff_id reutiliza `staff`, mismo patrón que teacher_assignments.
--
-- Gestionar el horario (crear franjas, asignar materia/profesor) es
-- decisión administrativa -- solo super_admin/school_admin/director.
-- Un profesor NO puede reasignarse a sí mismo a otras franjas (evita
-- caos de conflictos de horario); solo puede leer el suyo.
-- =========================================================================

create table if not exists class_periods (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    name text not null,
    start_time time not null,
    end_time time not null,
    sort_order int not null default 0,
    created_at timestamptz not null default now()
);
create index if not exists idx_class_periods_school on class_periods(school_id, sort_order);

alter table class_periods enable row level security;

drop policy if exists "class_periods_admin_manage" on class_periods;
create policy "class_periods_admin_manage" on class_periods
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

drop policy if exists "class_periods_school_read" on class_periods;
create policy "class_periods_school_read" on class_periods
for select using (
    school_id in (select school_id from users_profiles where auth_id = auth.uid())
);

grant select on class_periods to authenticated;
grant all privileges on class_periods to service_role;

create table if not exists class_schedules (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    grade_level text not null,
    day_of_week int not null check (day_of_week between 1 and 6), -- 1=lunes ... 6=sábado
    period_id uuid not null references class_periods(id) on delete cascade,
    subject_id uuid references subjects(id) on delete set null,
    staff_id uuid references staff(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (school_id, grade_level, day_of_week, period_id)
);
create index if not exists idx_class_schedules_school_grade on class_schedules(school_id, grade_level);
create index if not exists idx_class_schedules_staff on class_schedules(staff_id);

alter table class_schedules enable row level security;

drop policy if exists "class_schedules_admin_manage" on class_schedules;
create policy "class_schedules_admin_manage" on class_schedules
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

-- Staff no-admin: recepción/finanzas ven todo el horario (logística); un
-- profesor solo ve los grados a los que está asignado, o cualquier franja
-- donde él mismo sea el profesor (por si da clase en un grado sin
-- asignación formal, ej. suplencia).
drop policy if exists "class_schedules_staff_read" on class_schedules;
create policy "class_schedules_staff_read" on class_schedules
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin', 'school_admin', 'director', 'reception', 'finance')
    )
    or (
        school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
        and (
            -- 3 argumentos explícitos: existe una sobrecarga más nueva
            -- teacher_is_assigned_to_grade(uuid, text, text default
            -- 'regular') que hace ambiguo llamarla con solo 2.
            teacher_is_assigned_to_grade(school_id, grade_level, 'regular')
            or staff_id in (select staff_id from users_profiles where auth_id = auth.uid() and staff_id is not null)
        )
    )
);

drop policy if exists "class_schedules_guardian_read" on class_schedules;
create policy "class_schedules_guardian_read" on class_schedules
for select using (
    grade_level in (
        select s.grade_level from students s
        join student_guardians sg on sg.student_id = s.id
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
);

grant select on class_schedules to authenticated;
grant all privileges on class_schedules to service_role;
