-- =========================================================================
-- SCHOOLOS — Migración 008: Módulo Academia (video-lecciones + cuestionarios
-- interactivos + gamificación + panel de progreso para el profesor)
-- =========================================================================

-- `users_profiles` ya tenía staff_id y guardian_id para vincular el login
-- con su registro correspondiente, pero NO student_id -- sin esto, un
-- estudiante con su propio login (role='student', ya contemplado en el
-- check constraint desde la migración 001) no tiene forma de vincularse
-- a su fila en `students`.
alter table users_profiles add column student_id uuid references students(id);

-- ── Lecciones ─────────────────────────────────────────────────────────────
create table lessons (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    subject_id uuid not null references subjects(id),
    grade_level_id uuid not null references grade_levels(id),
    title text not null,
    description text,
    video_url text not null,
    video_provider text not null default 'youtube' check (video_provider in ('youtube','vimeo')),
    sort_order int not null default 0,
    is_published boolean not null default false,
    created_by uuid references users_profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

-- ── Cuestionario de cada lección ──────────────────────────────────────────
create table quiz_questions (
    id uuid primary key default gen_random_uuid(),
    lesson_id uuid not null references lessons(id) on delete cascade,
    prompt text not null,
    sort_order int not null default 0,
    points int not null default 10,
    created_at timestamptz not null default now()
);

create table quiz_options (
    id uuid primary key default gen_random_uuid(),
    question_id uuid not null references quiz_questions(id) on delete cascade,
    label text not null,
    is_correct boolean not null default false,
    sort_order int not null default 0
);

-- ── Intentos del estudiante ───────────────────────────────────────────────
create table quiz_attempts (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    lesson_id uuid not null references lessons(id),
    student_id uuid not null references students(id),
    score int not null default 0,
    max_score int not null default 0,
    correct_count int not null default 0,
    total_questions int not null default 0,
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    created_at timestamptz not null default now()
);

create table quiz_answers (
    id uuid primary key default gen_random_uuid(),
    attempt_id uuid not null references quiz_attempts(id) on delete cascade,
    question_id uuid not null references quiz_questions(id),
    selected_option_id uuid references quiz_options(id),
    is_correct boolean not null default false
);

-- ── Gamificación ──────────────────────────────────────────────────────────
create table student_points (
    student_id uuid primary key references students(id),
    school_id uuid not null references schools(id),
    total_points int not null default 0,
    current_streak_days int not null default 0,
    longest_streak_days int not null default 0,
    last_activity_date date,
    updated_at timestamptz not null default now()
);

create table badges (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id),
    code text not null,
    name text not null,
    description text,
    icon text not null default '🏅',
    unique (school_id, code)
);

create table student_badges (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id),
    badge_id uuid not null references badges(id),
    awarded_at timestamptz not null default now(),
    unique (student_id, badge_id)
);

-- Insignias base para cada colegio existente (se puede ampliar luego)
insert into badges (school_id, code, name, description, icon)
select id, 'primera_leccion', 'Primer paso', 'Completaste tu primera lección', '🎬' from schools
union all
select id, 'racha_7_dias', 'Constancia', '7 días seguidos de actividad', '🔥' from schools
union all
select id, 'puntaje_perfecto', 'Perfecto', 'Respondiste todo correctamente en un cuestionario', '🌟' from schools;

-- ── Trigger: al completar un intento, actualiza puntos, racha y otorga
--    insignias automáticamente ─────────────────────────────────────────────
create or replace function handle_quiz_attempt_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_yesterday date := current_date - interval '1 day';
    v_is_first_lesson boolean;
    v_badge_id uuid;
begin
    if new.completed_at is null then
        return new;
    end if;
    if tg_op = 'UPDATE' and old.completed_at is not null then
        return new;  -- ya se procesó este intento antes, evita duplicar puntos
    end if;

    insert into student_points (student_id, school_id, total_points, current_streak_days, longest_streak_days, last_activity_date)
    values (new.student_id, new.school_id, new.score, 1, 1, current_date)
    on conflict (student_id) do update set
        total_points = student_points.total_points + new.score,
        current_streak_days = case
            when student_points.last_activity_date = current_date then student_points.current_streak_days
            when student_points.last_activity_date = v_yesterday then student_points.current_streak_days + 1
            else 1
        end,
        longest_streak_days = greatest(
            student_points.longest_streak_days,
            case
                when student_points.last_activity_date = current_date then student_points.current_streak_days
                when student_points.last_activity_date = v_yesterday then student_points.current_streak_days + 1
                else 1
            end
        ),
        last_activity_date = current_date,
        updated_at = now();

    -- Insignia: primera lección completada
    select not exists (
        select 1 from quiz_attempts
        where student_id = new.student_id and completed_at is not null and id != new.id
    ) into v_is_first_lesson;

    if v_is_first_lesson then
        select id into v_badge_id from badges where school_id = new.school_id and code = 'primera_leccion';
        if v_badge_id is not null then
            insert into student_badges (student_id, badge_id) values (new.student_id, v_badge_id)
            on conflict do nothing;
        end if;
    end if;

    -- Insignia: puntaje perfecto
    if new.max_score > 0 and new.score = new.max_score then
        select id into v_badge_id from badges where school_id = new.school_id and code = 'puntaje_perfecto';
        if v_badge_id is not null then
            insert into student_badges (student_id, badge_id) values (new.student_id, v_badge_id)
            on conflict do nothing;
        end if;
    end if;

    -- Insignia: racha de 7 días
    if (select current_streak_days from student_points where student_id = new.student_id) >= 7 then
        select id into v_badge_id from badges where school_id = new.school_id and code = 'racha_7_dias';
        if v_badge_id is not null then
            insert into student_badges (student_id, badge_id) values (new.student_id, v_badge_id)
            on conflict do nothing;
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists trigger_quiz_attempt_completed on quiz_attempts;
create trigger trigger_quiz_attempt_completed
    after insert or update on quiz_attempts
    for each row
    execute function handle_quiz_attempt_completed();

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table lessons        enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_options   enable row level security;
alter table quiz_attempts  enable row level security;
alter table quiz_answers   enable row level security;
alter table student_points enable row level security;
alter table badges         enable row level security;
alter table student_badges enable row level security;

-- Lecciones: staff del colegio gestiona todo
drop policy if exists "lessons_staff_all" on lessons;
create policy "lessons_staff_all" on lessons
for all using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid()
        and role in ('super_admin','school_admin','director','teacher')
    )
);

-- Lecciones: el estudiante ve solo las publicadas de su propio grado
drop policy if exists "lessons_student_read" on lessons;
create policy "lessons_student_read" on lessons
for select using (
    is_published = true
    and grade_level_id in (
        select e.grade_level_id from enrollments e
        join users_profiles up on up.student_id = e.student_id
        where up.auth_id = auth.uid() and e.status = 'inscrito'
    )
);

-- Lecciones: el tutor ve las publicadas del grado de sus hijos
drop policy if exists "lessons_guardian_read" on lessons;
create policy "lessons_guardian_read" on lessons
for select using (
    is_published = true
    and grade_level_id in (
        select e.grade_level_id from enrollments e
        join student_guardians sg on sg.student_id = e.student_id
        join users_profiles up on up.guardian_id = sg.guardian_id
        where up.auth_id = auth.uid() and e.status = 'inscrito'
    )
);

-- Preguntas y opciones: siguen el acceso de su lección
drop policy if exists "quiz_questions_via_lesson" on quiz_questions;
create policy "quiz_questions_via_lesson" on quiz_questions
for select using (
    lesson_id in (select id from lessons)  -- ya filtrado por las policies de lessons
);
drop policy if exists "quiz_questions_staff_manage" on quiz_questions;
create policy "quiz_questions_staff_manage" on quiz_questions
for all using (
    lesson_id in (
        select id from lessons where school_id in (
            select school_id from users_profiles
            where auth_id = auth.uid() and role in ('super_admin','school_admin','director','teacher')
        )
    )
);

drop policy if exists "quiz_options_via_question" on quiz_options;
create policy "quiz_options_via_question" on quiz_options
for select using (
    question_id in (select id from quiz_questions)
);
drop policy if exists "quiz_options_staff_manage" on quiz_options;
create policy "quiz_options_staff_manage" on quiz_options
for all using (
    question_id in (
        select qq.id from quiz_questions qq
        join lessons l on l.id = qq.lesson_id
        where l.school_id in (
            select school_id from users_profiles
            where auth_id = auth.uid() and role in ('super_admin','school_admin','director','teacher')
        )
    )
);

-- Intentos: el propio estudiante crea/lee/actualiza los suyos
drop policy if exists "quiz_attempts_student_own" on quiz_attempts;
create policy "quiz_attempts_student_own" on quiz_attempts
for all using (
    student_id in (select student_id from users_profiles where auth_id = auth.uid() and student_id is not null)
);

-- Intentos: el staff/profesor del colegio los lee (panel de progreso)
drop policy if exists "quiz_attempts_staff_read" on quiz_attempts;
create policy "quiz_attempts_staff_read" on quiz_attempts
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director','teacher')
    )
);

-- Respuestas: siguen el acceso del intento
drop policy if exists "quiz_answers_student_own" on quiz_answers;
create policy "quiz_answers_student_own" on quiz_answers
for all using (
    attempt_id in (
        select id from quiz_attempts where student_id in (
            select student_id from users_profiles where auth_id = auth.uid() and student_id is not null
        )
    )
);
drop policy if exists "quiz_answers_staff_read" on quiz_answers;
create policy "quiz_answers_staff_read" on quiz_answers
for select using (
    attempt_id in (
        select id from quiz_attempts where school_id in (
            select school_id from users_profiles
            where auth_id = auth.uid() and role in ('super_admin','school_admin','director','teacher')
        )
    )
);

-- Puntos: el propio estudiante y el staff del colegio
drop policy if exists "student_points_own_read" on student_points;
create policy "student_points_own_read" on student_points
for select using (
    student_id in (select student_id from users_profiles where auth_id = auth.uid() and student_id is not null)
);
drop policy if exists "student_points_staff_read" on student_points;
create policy "student_points_staff_read" on student_points
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director','teacher')
    )
);

-- Insignias: catálogo visible para todo el colegio
drop policy if exists "badges_school_read" on badges;
create policy "badges_school_read" on badges
for select using (
    school_id in (select school_id from users_profiles where auth_id = auth.uid())
);

-- Insignias otorgadas: el propio estudiante y el staff
drop policy if exists "student_badges_own_read" on student_badges;
create policy "student_badges_own_read" on student_badges
for select using (
    student_id in (select student_id from users_profiles where auth_id = auth.uid() and student_id is not null)
);
drop policy if exists "student_badges_staff_read" on student_badges;
create policy "student_badges_staff_read" on student_badges
for select using (
    student_id in (
        select s.id from students s where s.school_id in (
            select school_id from users_profiles
            where auth_id = auth.uid() and role in ('super_admin','school_admin','director','teacher')
        )
    )
);
