-- =========================================================================
-- Informe docente: Academia solo con el total (pedido del usuario, 2026-09-22)
--
-- La lista de nombres de quienes no tienen lecciones era de 20 de 21 docentes:
-- demasiado larga para el grupo de WhatsApp. Se deja solo el conteo. La parte
-- de Asistencia sigue con nombres. Solo reemplaza private.teacher_daily_report
-- (create or replace); el cron y el envío no cambian. Idempotente.
-- =========================================================================

create or replace function private.teacher_daily_report(
  p_school_id uuid,
  p_date date
)
returns text
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_dow int := extract(isodow from p_date)::int;   -- 1=lunes ... 7=domingo
  v_dias text[] := array['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  v_titulo text;
  v_esperados int;
  v_cumplieron int;
  v_sin_lista text;
  v_sin_acceso text;
  v_docentes int;
  v_activos_hoy int;
  v_sin_academia text;
  v_sin_academia_n int;
  v_out text;
begin
  v_titulo := '📋 *Seguimiento docente – ' || v_dias[v_dow] || ' ' || to_char(p_date, 'DD/MM') || '*';

  if v_dow = 7 then
    return v_titulo || E'\nDomingo: no hay clases.';
  end if;

  if exists (
    select 1 from calendar_events
    where school_id = p_school_id and event_date = p_date and category = 'feriado'
      and grade_level is null and deleted_at is null
  ) then
    return v_titulo || E'\nDía feriado en la Agenda: no se evalúa.';
  end if;

  -- Docentes con clase ese día, y si pasaron lista.
  with esperados as (
    select distinct s.id as staff_id,
           private.teacher_short_name(s.first_name, s.last_name) as nombre
    from class_schedules cs
    join staff s on s.id = cs.staff_id and s.deleted_at is null
    where cs.school_id = p_school_id and cs.day_of_week = v_dow
    union
    -- Docentes SIN ninguna franja en el horario pero con un curso asignado
    -- (Inicial y titulares cuyo horario no está cargado): pasan lista todos
    -- los días de lunes a viernes. Sin esto, nunca se les esperaría y un día
    -- sin lista pasaría inadvertido (verificado contra producción el
    -- 2026-09-22: Kinder, Pre Kinder, Párvulo, Pre Primario y 6to. Primaria
    -- pasan lista a diario y ninguno tiene horario cargado).
    select distinct s.id,
           private.teacher_short_name(s.first_name, s.last_name)
    from teacher_assignments ta
    join staff s on s.id = ta.staff_id and s.deleted_at is null
    where ta.school_id = p_school_id and ta.grade_level is not null
      and v_dow between 1 and 5
      and not exists (select 1 from class_schedules cs2 where cs2.staff_id = s.id)
  ),
  estado as (
    select e.nombre,
           up.id as profile_id,
           exists (
             select 1 from attendance a
             where a.recorded_by = up.id and a.date = p_date and a.school_id = p_school_id
           ) as cumplio
    from esperados e
    left join users_profiles up on up.staff_id = e.staff_id
  )
  select count(*),
         count(*) filter (where cumplio),
         string_agg(nombre, ', ' order by nombre) filter (where not cumplio and profile_id is not null),
         string_agg(nombre, ', ' order by nombre) filter (where profile_id is null)
    into v_esperados, v_cumplieron, v_sin_lista, v_sin_acceso
  from estado;

  -- Academia: docentes con acceso (perfil de rol teacher, ficha activa).
  with docentes as (
    select up.id as profile_id,
           private.teacher_short_name(s.first_name, s.last_name) as nombre
    from users_profiles up
    join staff s on s.id = up.staff_id and s.deleted_at is null
    where up.school_id = p_school_id and up.role = 'teacher'
  )
  select count(*),
         count(*) filter (where exists (
           select 1 from lessons l
           where l.created_by = d.profile_id and l.deleted_at is null
             and ((l.created_at at time zone 'America/Santo_Domingo')::date = p_date
               or (l.updated_at at time zone 'America/Santo_Domingo')::date = p_date))),
         count(*) filter (where not exists (
           select 1 from lessons l where l.created_by = d.profile_id and l.deleted_at is null
             and (l.created_at at time zone 'America/Santo_Domingo')::date <= p_date)),
         string_agg(nombre, ', ' order by nombre) filter (where not exists (
           select 1 from lessons l where l.created_by = d.profile_id and l.deleted_at is null
             and (l.created_at at time zone 'America/Santo_Domingo')::date <= p_date))
    into v_docentes, v_activos_hoy, v_sin_academia_n, v_sin_academia
  from docentes d;

  v_out := v_titulo || E'\n\n';

  if v_esperados = 0 then
    v_out := v_out || E'📝 *Asistencia:* ningún docente tenía clases en el horario.\n';
  else
    v_out := v_out || '📝 *Asistencia:* ' || v_cumplieron || ' de ' || v_esperados || E' docentes pasaron lista\n';
    if v_sin_lista is not null then
      v_out := v_out || '❌ Sin pasar lista: ' || v_sin_lista || E'\n';
    else
      v_out := v_out || E'✅ Todos los docentes con acceso pasaron lista\n';
    end if;
    if v_sin_acceso is not null then
      v_out := v_out || '⚠️ Sin acceso a la plataforma: ' || v_sin_acceso || E'\n';
    end if;
  end if;

  v_out := v_out || E'\n🎓 *Academia:* ' || v_activos_hoy || ' de ' || v_docentes || E' docentes crearon o editaron lecciones ese día\n';
  if v_sin_academia_n > 0 then
    v_out := v_out || '❌ Aún sin ninguna lección: ' || v_sin_academia_n || ' de ' || v_docentes || E' docentes\n';
  else
    v_out := v_out || E'✅ Todos los docentes ya tienen al menos una lección\n';
  end if;

  return v_out;
end;
$$;

revoke execute on function private.teacher_daily_report(uuid, date) from public, anon, authenticated;
