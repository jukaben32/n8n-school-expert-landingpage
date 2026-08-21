-- =========================================================================
-- MentorIApp — Notas y boletines (4/4, inspirado en TokApp iEduca)
--
-- grading_periods: los periodos de calificación del año (ej. "1er
-- Trimestre"), una sola vez para todo el colegio.
--
-- grades: una nota por estudiante + materia + periodo. subject_id
-- reutiliza el catálogo `subjects` ya existente; el vínculo "qué materia
-- le corresponde a qué grado, y quién la enseña" ya existe en
-- class_schedules (Horarios, 2/4) -- se reutiliza para autorizar qué
-- profesor puede calificar qué combinación de estudiante+materia, en vez
-- de duplicar esa relación.
-- =========================================================================

create table if not exists grading_periods (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    name text not null,
    start_date date not null,
    end_date date not null,
    sort_order int not null default 0,
    created_at timestamptz not null default now()
);
create index if not exists idx_grading_periods_school on grading_periods(school_id, sort_order);

alter table grading_periods enable row level security;

drop policy if exists "grading_periods_admin_manage" on grading_periods;
create policy "grading_periods_admin_manage" on grading_periods
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

drop policy if exists "grading_periods_school_read" on grading_periods;
create policy "grading_periods_school_read" on grading_periods
for select using (
    school_id in (select school_id from users_profiles where auth_id = auth.uid())
);

grant select on grading_periods to authenticated;
grant all privileges on grading_periods to service_role;

create table if not exists grades (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    student_id uuid not null references students(id) on delete cascade,
    subject_id uuid not null references subjects(id) on delete cascade,
    grading_period_id uuid not null references grading_periods(id) on delete cascade,
    score numeric(5,2) not null check (score >= 0 and score <= 100),
    comment text,
    created_by uuid not null references users_profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (student_id, subject_id, grading_period_id)
);
create index if not exists idx_grades_student_period on grades(student_id, grading_period_id);
create index if not exists idx_grades_school on grades(school_id);

alter table grades enable row level security;

drop policy if exists "grades_admin_manage" on grades;
create policy "grades_admin_manage" on grades
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

-- Profesor: gestiona solo notas de estudiantes cuyo grado+materia
-- coincide con una franja de class_schedules donde ÉL es el profesor
-- (misma relación que ya autoriza Planificación de clases).
drop policy if exists "grades_teacher_own" on grades;
create policy "grades_teacher_own" on grades
for all using (
    school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
    and exists (
        select 1 from students s
        join class_schedules cs on cs.school_id = s.school_id and cs.grade_level = s.grade_level and cs.subject_id = grades.subject_id
        join users_profiles up on up.staff_id = cs.staff_id
        where s.id = grades.student_id and up.auth_id = auth.uid()
    )
) with check (
    school_id in (select school_id from users_profiles where auth_id = auth.uid() and role = 'teacher')
    and exists (
        select 1 from students s
        join class_schedules cs on cs.school_id = s.school_id and cs.grade_level = s.grade_level and cs.subject_id = grades.subject_id
        join users_profiles up on up.staff_id = cs.staff_id
        where s.id = grades.student_id and up.auth_id = auth.uid()
    )
);

-- Recepción/finanzas: solo lectura de todo el colegio (imprimir boletines,
-- no calificar).
drop policy if exists "grades_frontdesk_read" on grades;
create policy "grades_frontdesk_read" on grades
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('reception', 'finance')
    )
);

drop policy if exists "grades_guardian_read" on grades;
create policy "grades_guardian_read" on grades
for select using (
    student_id in (
        select sg.student_id from student_guardians sg
        join guardians g on g.id = sg.guardian_id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid() and up.role = 'guardian'
    )
);

grant select, insert, update, delete on grades to authenticated;
grant all privileges on grades to service_role;
