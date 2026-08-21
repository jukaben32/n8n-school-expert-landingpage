-- =========================================================================
-- MentorIApp — Agenda digital: calendar_events
--
-- Eventos del colegio (reunión de padres, feriado, evaluación, actividad
-- extracurricular...) dirigidos a todo el colegio o a un grado/sección
-- puntual. Mismo modelo de targeting que class_updates (migración 032):
-- grade_level (texto libre, el mismo campo que students.grade_level) nulo
-- = todo el colegio, no nulo = un solo grado. Se eligió texto libre en vez
-- del catálogo grade_levels/enrollments porque ese catálogo nunca se llegó
-- a poblar -- ver AGENTS.md, sección "Notificaciones por correo" y la nota
-- de teacher_assignments sobre los dos sistemas de grado en paralelo.
-- =========================================================================

create table if not exists calendar_events (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    author_profile_id uuid not null references users_profiles(id),
    title text not null,
    description text,
    event_date date not null,
    start_time time,
    end_time time,
    location text,
    category text not null default 'general'
        check (category in ('general', 'academico', 'feriado', 'reunion', 'extracurricular', 'evaluacion')),
    grade_level text, -- null = todo el colegio
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create index if not exists idx_calendar_events_school_date on calendar_events(school_id, event_date) where deleted_at is null;

alter table calendar_events enable row level security;

drop policy if exists "calendar_events_staff_all" on calendar_events;
create policy "calendar_events_staff_all" on calendar_events
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
          and role in ('super_admin', 'school_admin', 'director', 'teacher', 'reception')
    )
) with check (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
          and role in ('super_admin', 'school_admin', 'director', 'teacher', 'reception')
    )
);

drop policy if exists "calendar_events_guardian_read" on calendar_events;
create policy "calendar_events_guardian_read" on calendar_events
for select using (
    deleted_at is null
    and (
        grade_level is null
        or grade_level in (
            select s.grade_level from students s
            join student_guardians sg on sg.student_id = s.id
            join guardians g on g.id = sg.guardian_id
            join users_profiles up on up.guardian_id = g.id
            where up.auth_id = auth.uid() and up.role = 'guardian'
        )
    )
);

grant select on calendar_events to authenticated;
grant all privileges on calendar_events to service_role;
