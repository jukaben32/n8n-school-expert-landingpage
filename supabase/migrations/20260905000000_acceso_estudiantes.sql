-- =========================================================================
-- Acceso de estudiantes: login propio, voto directo y Academia
--
-- Pedido del colegio (2026-09-04): "los estudiantes votan", así que hace
-- falta habilitar un acceso para ellos. Ese mismo login servirá para las
-- tareas, videos y cuestionarios de Academia.
--
-- La migración anterior (20260904000000) diseñó la votación como una URNA
-- SUPERVISADA porque en ese momento NINGÚN estudiante tenía cuenta (0 de
-- 269). Esa urna se conserva -- sigue siendo la única vía para los cursos
-- pequeños (Párvulo, Kinder...) donde no tiene sentido dar un login. Lo
-- que se agrega es la segunda vía: el estudiante con cuenta vota él mismo.
--
-- Cómo entra un estudiante: no tienen correo, así que se les crea una
-- cuenta con un código de acceso (`students.access_code`) y una contraseña
-- temporal que el colegio les entrega impresa -- exactamente el mismo
-- patrón que ya se usa con los tutores sin correo
-- (`createPhoneBasedAccess` en dashboard/familias/actions.ts).
--
-- CAMBIO IMPORTANTE DE SEGURIDAD -- el voto ya no se escribe desde la app.
-- Antes la aplicación insertaba en `poll_voters` y luego en `poll_ballots`
-- con dos escrituras separadas. Eso era aceptable mientras solo el
-- personal podía escribir (cuenta de confianza, supervisando el aula),
-- pero deja de serlo en cuanto un estudiante tiene credenciales propias:
-- con la API pública podría marcarse una vez en el padrón y luego insertar
-- todas las papeletas que quisiera. Ahora las tres operaciones de voto
-- viven en funciones SECURITY DEFINER que hacen padrón + papeletas en UNA
-- SOLA transacción y validan cada candidato; a `authenticated` se le retira
-- el permiso de insertar directamente en la urna y en el padrón.
--
-- De paso esto corrige un bug real: las encuestas dirigidas a "familias"
-- nunca funcionaron, porque la única policy de inserción del padrón exigía
-- `can_run_poll()`, que es exclusiva del personal.
-- =========================================================================

-- ── 1. Código de acceso del estudiante ───────────────────────────────────
-- Columna aparte de `student_code` a propósito: ese campo es la matrícula
-- del colegio (hoy vacío, pero suyo). Este es el usuario de entrada.
alter table students add column if not exists access_code text;
create unique index if not exists idx_students_access_code
    on students (lower(access_code)) where access_code is not null;

-- ── 2. ¿Quién soy, como estudiante? ──────────────────────────────────────
create or replace function current_student_id()
returns uuid language sql security definer stable set search_path = public as $$
    select student_id from users_profiles
    where auth_id = auth.uid() and role = 'student' and student_id is not null
    limit 1
$$;

-- ── 3. Encuestas dirigidas también a estudiantes ─────────────────────────
-- El check de `audience` se creó sin nombre explícito, así que se localiza
-- por su definición (la que menciona 'staff') en vez de adivinar el nombre.
do $$
declare v_name text;
begin
    select conname into v_name
    from pg_constraint
    where conrelid = 'polls'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%staff%';
    if v_name is not null then
        execute format('alter table polls drop constraint %I', v_name);
    end if;
end $$;

alter table polls add constraint polls_audience_check
    check (audience is null or audience in ('staff', 'familias', 'ambos', 'estudiantes', 'todos'));

-- ── 4. ¿Este estudiante puede ver/participar en esta encuesta? ───────────
-- Votación: solo la de SU curso. Encuesta: solo si va dirigida a
-- estudiantes. En ningún caso los borradores.
create or replace function student_can_see_poll(p_poll_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
    select exists (
        select 1
        from polls p
        join students s on s.id = current_student_id()
        where p.id = p_poll_id
          and p.school_id = s.school_id
          and s.deleted_at is null
          and p.status in ('abierta', 'cerrada')
          and (
            (p.type = 'votacion' and p.grade_level is not null and p.grade_level = s.grade_level)
            or (p.type = 'encuesta' and p.audience in ('estudiantes', 'todos'))
          )
    )
$$;

-- ¿Puede esta persona responder ESTA encuesta? (personal, familia o
-- estudiante, según a quién vaya dirigida)
create or replace function can_answer_encuesta(p_poll_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
    select exists (
        select 1 from polls p
        where p.id = p_poll_id and p.type = 'encuesta' and p.status = 'abierta'
          and (
            (p.audience in ('staff', 'ambos', 'todos') and is_school_staff(p.school_id))
            or (p.audience in ('familias', 'ambos', 'todos') and exists (
                select 1 from users_profiles up
                where up.auth_id = auth.uid() and up.school_id = p.school_id
                  and up.role = 'guardian'
            ))
            or (p.audience in ('estudiantes', 'todos') and student_can_see_poll(p_poll_id))
          )
    )
$$;

-- ¿Puede ver los resultados publicados? Personal siempre; el estudiante
-- los de su curso/encuesta; y quien participó, los de esa encuesta.
create or replace function can_view_poll_results(p_poll_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
    select exists (select 1 from polls p where p.id = p_poll_id and is_school_staff(p.school_id))
        or student_can_see_poll(p_poll_id)
        or exists (
            select 1 from poll_voters pv
            join users_profiles up on up.id = pv.profile_id
            where pv.poll_id = p_poll_id and up.auth_id = auth.uid()
        )
$$;

-- ── 5. Lectura para el estudiante ────────────────────────────────────────
drop policy if exists "polls_student_read" on polls;
create policy "polls_student_read" on polls for select using (student_can_see_poll(id));

drop policy if exists "poll_positions_student_read" on poll_positions;
create policy "poll_positions_student_read" on poll_positions for select
    using (student_can_see_poll(poll_id));

drop policy if exists "poll_candidates_student_read" on poll_candidates;
create policy "poll_candidates_student_read" on poll_candidates for select
    using (exists (select 1 from poll_positions pp where pp.id = position_id and student_can_see_poll(pp.poll_id)));

drop policy if exists "poll_questions_student_read" on poll_questions;
create policy "poll_questions_student_read" on poll_questions for select
    using (student_can_see_poll(poll_id));

-- Del padrón, el estudiante solo ve SU propia fila -- lo justo para que la
-- pantalla sepa que ya votó. Nunca el padrón completo del curso.
drop policy if exists "poll_voters_own_read" on poll_voters;
create policy "poll_voters_own_read" on poll_voters for select
    using (
        (student_id is not null and student_id = current_student_id())
        or (profile_id is not null and exists (
            select 1 from users_profiles up where up.id = profile_id and up.auth_id = auth.uid()
        ))
    );

-- ── 6. El voto, en una sola transacción y validado en la base ────────────
-- Sin estas funciones no hay forma de votar: más abajo se le retira a
-- `authenticated` el insert directo sobre el padrón y la urna.

-- Comprueba que cada elección apunte a un cargo de ESTA votación y a un
-- candidato de ESE cargo, y que no haya dos elecciones para el mismo cargo.
create or replace function assert_valid_choices(p_poll_id uuid, p_choices jsonb)
returns void language plpgsql stable set search_path = public as $$
begin
    if p_choices is null or jsonb_array_length(p_choices) = 0 then
        raise exception 'No se seleccionó ningún candidato';
    end if;

    if (select count(distinct c->>'positionId') from jsonb_array_elements(p_choices) c)
       <> jsonb_array_length(p_choices) then
        raise exception 'Solo se puede votar una vez por cargo';
    end if;

    if exists (
        select 1 from jsonb_array_elements(p_choices) c
        where not exists (
            select 1 from poll_candidates pc
            join poll_positions pp on pp.id = pc.position_id
            where pc.id = (c->>'candidateId')::uuid
              and pp.id = (c->>'positionId')::uuid
              and pp.poll_id = p_poll_id
        )
    ) then
        raise exception 'Hay un candidato que no pertenece a esta votación';
    end if;
end;
$$;

-- (a) El estudiante vota desde su propia cuenta.
create or replace function cast_student_vote(p_poll_id uuid, p_choices jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_student_id uuid := current_student_id();
begin
    if v_student_id is null then
        raise exception 'Solo un estudiante con acceso puede votar aquí';
    end if;
    if not exists (select 1 from polls where id = p_poll_id and type = 'votacion' and status = 'abierta') then
        raise exception 'La votación no está abierta';
    end if;
    if not student_can_see_poll(p_poll_id) then
        raise exception 'Esta votación no es de tu curso';
    end if;

    perform assert_valid_choices(p_poll_id, p_choices);

    begin
        insert into poll_voters (poll_id, student_id) values (p_poll_id, v_student_id);
    exception when unique_violation then
        raise exception 'Ya votaste en esta votación';
    end;

    insert into poll_ballots (poll_id, position_id, candidate_id)
    select p_poll_id, (c->>'positionId')::uuid, (c->>'candidateId')::uuid
    from jsonb_array_elements(p_choices) c;
end;
$$;

-- (b) La urna del aula: el profesor supervisa y el estudiante marca.
-- Se conserva para los cursos donde los estudiantes no tienen cuenta.
create or replace function cast_urna_vote(p_poll_id uuid, p_student_id uuid, p_choices jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_profile_id uuid;
begin
    if not can_run_poll(p_poll_id) then
        raise exception 'No puedes operar esta votación';
    end if;
    if not exists (select 1 from polls where id = p_poll_id and type = 'votacion' and status = 'abierta') then
        raise exception 'La votación no está abierta';
    end if;
    if not exists (
        select 1 from students s join polls p on p.id = p_poll_id
        where s.id = p_student_id and s.school_id = p.school_id
          and s.grade_level = p.grade_level and s.deleted_at is null
    ) then
        raise exception 'Ese estudiante no pertenece al curso de esta votación';
    end if;

    perform assert_valid_choices(p_poll_id, p_choices);

    select id into v_profile_id from users_profiles where auth_id = auth.uid();

    begin
        insert into poll_voters (poll_id, student_id, recorded_by)
        values (p_poll_id, p_student_id, v_profile_id);
    exception when unique_violation then
        raise exception 'Este estudiante ya votó';
    end;

    insert into poll_ballots (poll_id, position_id, candidate_id)
    select p_poll_id, (c->>'positionId')::uuid, (c->>'candidateId')::uuid
    from jsonb_array_elements(p_choices) c;
end;
$$;

-- (c) Responder una encuesta (personal, familia o estudiante).
create or replace function submit_poll_response(p_poll_id uuid, p_answers jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
    v_student_id uuid := current_student_id();
    v_profile_id uuid;
begin
    if not can_answer_encuesta(p_poll_id) then
        raise exception 'Esta encuesta no está abierta para ti';
    end if;
    if p_answers is null or jsonb_array_length(p_answers) = 0 then
        raise exception 'No se envió ninguna respuesta';
    end if;
    if exists (
        select 1 from jsonb_array_elements(p_answers) a
        where not exists (
            select 1 from poll_questions pq
            where pq.id = (a->>'questionId')::uuid and pq.poll_id = p_poll_id
        )
    ) then
        raise exception 'Hay una respuesta que no corresponde a esta encuesta';
    end if;

    select id into v_profile_id from users_profiles where auth_id = auth.uid();

    begin
        -- El estudiante se marca por `student_id`; el resto por `profile_id`.
        if v_student_id is not null then
            insert into poll_voters (poll_id, student_id) values (p_poll_id, v_student_id);
        else
            insert into poll_voters (poll_id, profile_id, recorded_by)
            values (p_poll_id, v_profile_id, v_profile_id);
        end if;
    exception when unique_violation then
        raise exception 'Ya respondiste esta encuesta';
    end;

    insert into poll_ballots (poll_id, question_id, answer_option, answer_scale, answer_text)
    select p_poll_id,
           (a->>'questionId')::uuid,
           nullif(a->>'option', ''),
           nullif(a->>'scale', '')::int,
           nullif(a->>'text', '')
    from jsonb_array_elements(p_answers) a;
end;
$$;

-- ── 7. Se cierra la escritura directa sobre padrón y urna ────────────────
drop policy if exists "poll_voters_insert" on poll_voters;
drop policy if exists "poll_ballots_insert" on poll_ballots;
drop policy if exists "poll_voters_read" on poll_voters;

-- El personal que opera la votación sigue viendo el padrón de su curso
-- (para saber a quién le falta votar); la propia fila la cubre
-- "poll_voters_own_read".
create policy "poll_voters_staff_read" on poll_voters for select using (can_run_poll(poll_id));

revoke insert on poll_voters from authenticated;
revoke insert on poll_ballots from authenticated;

-- ── 8. Resultados: también los ve quien participó ────────────────────────
create or replace function poll_results_votacion(p_poll_id uuid)
returns table(
    position_id uuid, position_name text, position_order int,
    candidate_id uuid, candidate_name text, votes bigint
)
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
    select status into v_status from polls where id = p_poll_id;
    if v_status is null then raise exception 'Votación no encontrada'; end if;
    if not can_view_poll_results(p_poll_id) then raise exception 'No autorizado'; end if;
    if v_status <> 'cerrada' then raise exception 'Los resultados solo se publican al cerrar la votación'; end if;

    return query
    select pp.id, pp.name, pp.sort_order, pc.id, pc.display_name, count(pb.id) as votes
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
    question_id uuid, question_text text, question_kind text, question_order int,
    answer text, responses bigint
)
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
    select status into v_status from polls where id = p_poll_id;
    if v_status is null then raise exception 'Encuesta no encontrada'; end if;
    if not can_view_poll_results(p_poll_id) then raise exception 'No autorizado'; end if;
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

create or replace function poll_reconciliation(p_poll_id uuid)
returns table(voters bigint, position_name text, ballots bigint)
language plpgsql security definer set search_path = public as $$
begin
    if not exists (select 1 from polls where id = p_poll_id) then raise exception 'No encontrada'; end if;
    if not can_view_poll_results(p_poll_id) then raise exception 'No autorizado'; end if;

    return query
    select (select count(*) from poll_voters pv where pv.poll_id = p_poll_id),
           pp.name,
           (select count(*) from poll_ballots pb where pb.position_id = pp.id)
    from poll_positions pp
    where pp.poll_id = p_poll_id
    order by pp.sort_order;
end;
$$;

-- ── 9. Academia: el estudiante necesita leer su propia inscripción ───────
-- `lessons_student_read` ya filtra las lecciones por el grado de la
-- inscripción, pero la pantalla de Academia consulta `enrollments`
-- directamente para saber ese grado, y ahí no había ninguna policy para
-- estudiantes -- la consulta volvía vacía y no se veía ninguna lección.
drop policy if exists "enrollments_student_own_read" on enrollments;
create policy "enrollments_student_own_read" on enrollments for select
    using (student_id = current_student_id());

-- Y a leer su propia ficha (nombre, curso).
drop policy if exists "students_own_read" on students;
create policy "students_own_read" on students for select using (id = current_student_id());

-- ── 10. Permisos ─────────────────────────────────────────────────────────
revoke execute on function current_student_id() from public;
revoke execute on function student_can_see_poll(uuid) from public;
revoke execute on function can_answer_encuesta(uuid) from public;
revoke execute on function can_view_poll_results(uuid) from public;
revoke execute on function assert_valid_choices(uuid, jsonb) from public;
revoke execute on function cast_student_vote(uuid, jsonb) from public;
revoke execute on function cast_urna_vote(uuid, uuid, jsonb) from public;
revoke execute on function submit_poll_response(uuid, jsonb) from public;

grant execute on function current_student_id() to authenticated, service_role;
grant execute on function student_can_see_poll(uuid) to authenticated, service_role;
grant execute on function can_answer_encuesta(uuid) to authenticated, service_role;
grant execute on function can_view_poll_results(uuid) to authenticated, service_role;
grant execute on function assert_valid_choices(uuid, jsonb) to authenticated, service_role;
grant execute on function cast_student_vote(uuid, jsonb) to authenticated, service_role;
grant execute on function cast_urna_vote(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function submit_poll_response(uuid, jsonb) to authenticated, service_role;
