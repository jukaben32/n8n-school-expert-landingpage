-- =========================================================================
-- Módulo de Encuestas y Votaciones
--
-- Pedido del colegio (nota de voz, 2026-09-03):
--   1. Encuestas oportunas -- por ejemplo, satisfacción con la plataforma.
--   2. Votaciones para elegir la junta directiva de CADA CURSO
--      (presidente, secretario, vocal...). "Así ellos pueden votar en la
--      plataforma y nadie puede decir que hubo trampa o algo así, que eso
--      nos pasó el año pasado."
--
-- Restricción real que define el diseño: los estudiantes NO tienen cuenta
-- en la plataforma (0 de 214 al 2026-09-03; users_profiles.student_id está
-- sin usar). Por eso la votación es una URNA SUPERVISADA EN EL AULA: el
-- profesor del curso abre la votación en su dispositivo y cada estudiante
-- pasa y marca su voto. Confirmado con el usuario, junto con que los
-- candidatos los cargan los profesores.
--
-- ANTIFRAUDE -- la idea central es que dos cosas nunca se cruzan:
--
--   `poll_voters`  = EL PADRÓN. Quién ya participó. Impide votar dos
--                    veces (unique) y deja constancia de quién supervisó.
--                    NO guarda qué votó.
--   `poll_ballots` = LA URNA. Qué se votó. NO tiene ninguna columna que
--                    apunte al votante, y a propósito TAMPOCO guarda hora
--                    (un timestamp permitiría cruzar el orden de la urna
--                    con el orden del padrón y desanonimizar el voto).
--
-- Además:
--   - Nadie puede LEER `poll_ballots` por la API: no existe policy de
--     select. Los resultados solo salen por las funciones de conteo, y
--     solo cuando la votación está cerrada.
--   - El cuadre (votantes vs. votos por cargo) queda a la vista en el
--     acta: si no coincide, se nota.
--   - Ni el profesor ni dirección pueden cambiar un voto: no hay policy
--     de update ni delete sobre la urna.
-- =========================================================================

-- ── Encuesta o votación ──────────────────────────────────────────────────
create table if not exists polls (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references schools(id) on delete cascade,
    type text not null check (type in ('encuesta', 'votacion')),
    title text not null,
    description text,
    -- Solo votaciones: el curso cuya junta directiva se elige.
    grade_level text,
    -- Solo encuestas: a quién va dirigida.
    audience text check (audience in ('staff', 'familias', 'ambos')),
    status text not null default 'borrador'
        check (status in ('borrador', 'abierta', 'cerrada')),
    created_by uuid references users_profiles(id),
    opened_at timestamptz,
    closed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- Una votación siempre es de un curso; una encuesta siempre tiene público.
    check (type <> 'votacion' or grade_level is not null),
    check (type <> 'encuesta' or audience is not null)
);
create index if not exists idx_polls_school_status on polls(school_id, status);
create index if not exists idx_polls_grade on polls(grade_level) where grade_level is not null;

-- ── Cargos de la junta (votación) ────────────────────────────────────────
create table if not exists poll_positions (
    id uuid primary key default gen_random_uuid(),
    poll_id uuid not null references polls(id) on delete cascade,
    name text not null,                       -- 'Presidente', 'Secretario', 'Vocal'...
    sort_order int not null default 0,
    created_at timestamptz not null default now()
);
create index if not exists idx_poll_positions_poll on poll_positions(poll_id, sort_order);

-- ── Candidatos por cargo (los carga el profesor) ─────────────────────────
create table if not exists poll_candidates (
    id uuid primary key default gen_random_uuid(),
    position_id uuid not null references poll_positions(id) on delete cascade,
    student_id uuid references students(id) on delete set null,
    display_name text not null,               -- nombre mostrado en la papeleta
    sort_order int not null default 0,
    created_at timestamptz not null default now()
);
create index if not exists idx_poll_candidates_position on poll_candidates(position_id, sort_order);

-- ── Preguntas (encuesta) ─────────────────────────────────────────────────
create table if not exists poll_questions (
    id uuid primary key default gen_random_uuid(),
    poll_id uuid not null references polls(id) on delete cascade,
    text text not null,
    kind text not null default 'opcion'
        check (kind in ('opcion', 'escala', 'texto')),
    options jsonb,                            -- ['Sí','No'] para 'opcion'; null en escala (1-5) y texto
    sort_order int not null default 0,
    created_at timestamptz not null default now()
);
create index if not exists idx_poll_questions_poll on poll_questions(poll_id, sort_order);

-- ── EL PADRÓN: quién ya participó (nunca qué votó) ───────────────────────
create table if not exists poll_voters (
    id uuid primary key default gen_random_uuid(),
    poll_id uuid not null references polls(id) on delete cascade,
    student_id uuid references students(id) on delete cascade,   -- votaciones de curso
    profile_id uuid references users_profiles(id) on delete cascade, -- encuestas a staff/familias
    recorded_by uuid references users_profiles(id),               -- quién supervisó la urna
    voted_at timestamptz not null default now(),
    check (student_id is not null or profile_id is not null)
);
create unique index if not exists idx_poll_voters_student on poll_voters(poll_id, student_id) where student_id is not null;
create unique index if not exists idx_poll_voters_profile on poll_voters(poll_id, profile_id) where profile_id is not null;

-- ── LA URNA: los votos, sin votante y sin hora ───────────────────────────
-- A propósito no hay created_at: un timestamp permitiría ordenar la urna y
-- cruzarla con el orden del padrón para saber quién votó qué.
create table if not exists poll_ballots (
    id uuid primary key default gen_random_uuid(),
    poll_id uuid not null references polls(id) on delete cascade,
    -- votación
    position_id uuid references poll_positions(id) on delete cascade,
    candidate_id uuid references poll_candidates(id) on delete cascade,
    -- encuesta
    question_id uuid references poll_questions(id) on delete cascade,
    answer_option text,
    answer_scale int check (answer_scale is null or answer_scale between 1 and 5),
    answer_text text
);
create index if not exists idx_poll_ballots_poll on poll_ballots(poll_id);
create index if not exists idx_poll_ballots_position on poll_ballots(position_id) where position_id is not null;
create index if not exists idx_poll_ballots_question on poll_ballots(question_id) where question_id is not null;

-- =========================================================================
-- RLS
-- =========================================================================
alter table polls enable row level security;
alter table poll_positions enable row level security;
alter table poll_candidates enable row level security;
alter table poll_questions enable row level security;
alter table poll_voters enable row level security;
alter table poll_ballots enable row level security;

-- ¿El usuario es staff de este colegio? (cualquier rol de trabajo)
create or replace function is_school_staff(p_school_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
    select exists (
        select 1 from users_profiles
        where auth_id = auth.uid() and school_id = p_school_id
          and role in ('super_admin','school_admin','director','teacher','finance','reception')
    )
$$;

-- ¿Puede administrar encuestas/votaciones? (crear, abrir, cerrar)
create or replace function can_manage_polls(p_school_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
    select exists (
        select 1 from users_profiles
        where auth_id = auth.uid() and school_id = p_school_id
          and role in ('super_admin','school_admin','director')
    )
$$;

-- ¿Puede operar ESTA votación? Dirección siempre; el profesor solo la de
-- un curso que tenga asignado (mismo mecanismo que Asistencia).
create or replace function can_run_poll(p_poll_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
    select exists (
        select 1 from polls p
        where p.id = p_poll_id
          and (
            can_manage_polls(p.school_id)
            or (
              p.grade_level is not null
              and exists (select 1 from users_profiles up where up.auth_id = auth.uid() and up.school_id = p.school_id and up.role = 'teacher')
              -- 3 argumentos explícitos: existe una sobrecarga
              -- teacher_is_assigned_to_grade(uuid, text, text default 'regular')
              -- que hace ambiguo llamarla con solo 2 (mismo caso que en
              -- class_schedules, migración 20260821010000).
              and teacher_is_assigned_to_grade(p.school_id, p.grade_level, 'regular')
            )
          )
    )
$$;

-- polls: staff del colegio ve; dirección administra
drop policy if exists "polls_staff_read" on polls;
create policy "polls_staff_read" on polls for select using (is_school_staff(school_id));

drop policy if exists "polls_admin_manage" on polls;
create policy "polls_admin_manage" on polls for all
    using (can_manage_polls(school_id)) with check (can_manage_polls(school_id));

-- cargos / preguntas: lectura para staff; escritura para dirección
drop policy if exists "poll_positions_read" on poll_positions;
create policy "poll_positions_read" on poll_positions for select
    using (exists (select 1 from polls p where p.id = poll_id and is_school_staff(p.school_id)));

drop policy if exists "poll_positions_manage" on poll_positions;
create policy "poll_positions_manage" on poll_positions for all
    using (exists (select 1 from polls p where p.id = poll_id and can_manage_polls(p.school_id)))
    with check (exists (select 1 from polls p where p.id = poll_id and can_manage_polls(p.school_id)));

drop policy if exists "poll_questions_read" on poll_questions;
create policy "poll_questions_read" on poll_questions for select
    using (exists (select 1 from polls p where p.id = poll_id and is_school_staff(p.school_id)));

drop policy if exists "poll_questions_manage" on poll_questions;
create policy "poll_questions_manage" on poll_questions for all
    using (exists (select 1 from polls p where p.id = poll_id and can_manage_polls(p.school_id)))
    with check (exists (select 1 from polls p where p.id = poll_id and can_manage_polls(p.school_id)));

-- candidatos: los CARGA EL PROFESOR del curso (o dirección)
drop policy if exists "poll_candidates_read" on poll_candidates;
create policy "poll_candidates_read" on poll_candidates for select
    using (exists (
        select 1 from poll_positions pp join polls p on p.id = pp.poll_id
        where pp.id = position_id and is_school_staff(p.school_id)
    ));

drop policy if exists "poll_candidates_manage" on poll_candidates;
create policy "poll_candidates_manage" on poll_candidates for all
    using (exists (select 1 from poll_positions pp where pp.id = position_id and can_run_poll(pp.poll_id)))
    with check (exists (select 1 from poll_positions pp where pp.id = position_id and can_run_poll(pp.poll_id)));

-- padrón: quien opera la votación puede ver quién ya votó y marcar votantes
drop policy if exists "poll_voters_read" on poll_voters;
create policy "poll_voters_read" on poll_voters for select using (can_run_poll(poll_id));

drop policy if exists "poll_voters_insert" on poll_voters;
create policy "poll_voters_insert" on poll_voters for insert
    with check (
        can_run_poll(poll_id)
        and exists (select 1 from polls p where p.id = poll_id and p.status = 'abierta')
    );

-- URNA: solo se puede INSERTAR, y solo con la votación abierta.
-- No hay policy de select/update/delete a propósito -- nadie lee ni toca
-- un voto por la API; los resultados salen por poll_results_*().
drop policy if exists "poll_ballots_insert" on poll_ballots;
create policy "poll_ballots_insert" on poll_ballots for insert
    with check (
        can_run_poll(poll_id)
        and exists (select 1 from polls p where p.id = poll_id and p.status = 'abierta')
    );

grant select on polls, poll_positions, poll_candidates, poll_questions, poll_voters to authenticated;
grant insert, update, delete on polls, poll_positions, poll_candidates, poll_questions to authenticated;
grant insert on poll_voters, poll_ballots to authenticated;
grant all privileges on polls, poll_positions, poll_candidates, poll_questions, poll_voters, poll_ballots to service_role;

-- =========================================================================
-- Resultados -- solo con la votación/encuesta CERRADA, para que nadie vea
-- conteos parciales que puedan influir mientras se vota.
-- =========================================================================
create or replace function poll_results_votacion(p_poll_id uuid)
returns table(
    position_id uuid,
    position_name text,
    position_order int,
    candidate_id uuid,
    candidate_name text,
    votes bigint
)
language plpgsql security definer set search_path = public as $$
declare v_school_id uuid; v_status text;
begin
    select school_id, status into v_school_id, v_status from polls where id = p_poll_id;
    if v_school_id is null then raise exception 'Votación no encontrada'; end if;
    if not is_school_staff(v_school_id) then raise exception 'No autorizado'; end if;
    if v_status <> 'cerrada' then raise exception 'Los resultados solo se publican al cerrar la votación'; end if;

    return query
    select pp.id, pp.name, pp.sort_order, pc.id, pc.display_name,
           count(pb.id) as votes
    from poll_positions pp
    join poll_candidates pc on pc.position_id = pp.id
    left join poll_ballots pb on pb.candidate_id = pc.id
    where pp.poll_id = p_poll_id
    group by pp.id, pp.name, pp.sort_order, pc.id, pc.display_name
    order by pp.sort_order, count(pb.id) desc, pc.display_name;
end;
$$;

create or replace function poll_results_encuesta(p_poll_id uuid)
returns table(
    question_id uuid,
    question_text text,
    question_kind text,
    question_order int,
    answer text,
    responses bigint
)
language plpgsql security definer set search_path = public as $$
declare v_school_id uuid; v_status text;
begin
    select school_id, status into v_school_id, v_status from polls where id = p_poll_id;
    if v_school_id is null then raise exception 'Encuesta no encontrada'; end if;
    if not is_school_staff(v_school_id) then raise exception 'No autorizado'; end if;
    if v_status <> 'cerrada' then raise exception 'Los resultados solo se publican al cerrar la encuesta'; end if;

    return query
    select pq.id, pq.text, pq.kind, pq.sort_order,
           coalesce(pb.answer_option, pb.answer_scale::text, pb.answer_text) as answer,
           count(pb.id) as responses
    from poll_questions pq
    left join poll_ballots pb on pb.question_id = pq.id
    where pq.poll_id = p_poll_id
    group by pq.id, pq.text, pq.kind, pq.sort_order,
             coalesce(pb.answer_option, pb.answer_scale::text, pb.answer_text)
    order by pq.sort_order, count(pb.id) desc;
end;
$$;

-- Cuadre del acta: votantes marcados vs. votos en la urna por cargo.
-- Visible siempre (no revela ningún voto, solo cantidades).
create or replace function poll_reconciliation(p_poll_id uuid)
returns table(
    voters bigint,
    position_name text,
    ballots bigint
)
language plpgsql security definer set search_path = public as $$
declare v_school_id uuid;
begin
    select school_id into v_school_id from polls where id = p_poll_id;
    if v_school_id is null then raise exception 'No encontrada'; end if;
    if not is_school_staff(v_school_id) then raise exception 'No autorizado'; end if;

    return query
    select (select count(*) from poll_voters pv where pv.poll_id = p_poll_id),
           pp.name,
           (select count(*) from poll_ballots pb where pb.position_id = pp.id)
    from poll_positions pp
    where pp.poll_id = p_poll_id
    order by pp.sort_order;
end;
$$;

revoke execute on function poll_results_votacion(uuid) from public;
revoke execute on function poll_results_encuesta(uuid) from public;
revoke execute on function poll_reconciliation(uuid) from public;
revoke execute on function is_school_staff(uuid) from public;
revoke execute on function can_manage_polls(uuid) from public;
revoke execute on function can_run_poll(uuid) from public;
grant execute on function poll_results_votacion(uuid) to authenticated, service_role;
grant execute on function poll_results_encuesta(uuid) to authenticated, service_role;
grant execute on function poll_reconciliation(uuid) to authenticated, service_role;
grant execute on function is_school_staff(uuid) to authenticated, service_role;
grant execute on function can_manage_polls(uuid) to authenticated, service_role;
grant execute on function can_run_poll(uuid) to authenticated, service_role;
