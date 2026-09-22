-- =========================================================================
-- Informe diario de seguimiento docente (pedido del usuario, 2026-09-22)
--
-- "Mientras la plataforma está en su fase inicial, diariamente dame un
-- informe de los docentes que no han pasado lista de asistencia y que no
-- han entrado a la academia... simplificado para poner en grupo de wasap."
--
-- Qué mide (decisiones tomadas con el usuario, no supuestas):
--   * ASISTENCIA: se espera lista de todo docente que tiene clase ese día
--     según class_schedules (day_of_week). "Pasó lista" = al menos una fila
--     de attendance ese día con recorded_by = su perfil. Un docente sin
--     clase ese día no aparece -- no se le puede exigir.
--   * ACADEMIA (opción A, confirmada): la plataforma NO registra visitas a
--     la pantalla de Academia, así que "actividad" = haber creado o editado
--     una lección (lessons.created_by). Se lista a quien todavía no ha
--     creado NINGUNA lección (acumulado), y se cuenta quién tuvo actividad
--     ese día.
--
-- Solo lectura sobre datos del colegio: no escribe nada en ninguna tabla.
-- El envío es por correo (Resend vía pg_net, mismo patrón que el correo de
-- leads -- body jsonb, NUNCA ::text, ver bugs #7 y #12 de AGENTS.md), con
-- el texto listo para copiar y pegar en WhatsApp.
--
-- Hora: 19:00 UTC = 3:00 pm hora RD (UTC-4 todo el año), lunes a viernes.
-- Idempotente.
-- =========================================================================

create extension if not exists pg_net with schema extensions;

-- Destinatarios (separados por coma). Configurable sin migración nueva.
insert into private.app_settings (key, value)
values ('teacher_report_emails', 'Cegmas@outlook.com')
on conflict (key) do nothing;

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
           initcap(split_part(trim(s.first_name), ' ', 1) || ' ' || split_part(trim(s.last_name), ' ', 1)) as nombre
    from class_schedules cs
    join staff s on s.id = cs.staff_id and s.deleted_at is null
    where cs.school_id = p_school_id and cs.day_of_week = v_dow
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
           initcap(split_part(trim(s.first_name), ' ', 1) || ' ' || split_part(trim(s.last_name), ' ', 1)) as nombre
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
    v_out := v_out || '❌ Aún sin ninguna lección (' || v_sin_academia_n || '): ' || v_sin_academia || E'\n';
  else
    v_out := v_out || E'✅ Todos los docentes ya tienen al menos una lección\n';
  end if;

  return v_out;
end;
$$;

revoke execute on function private.teacher_daily_report(uuid, date) from public, anon, authenticated;

-- Envía el informe del día (hora RD) a los destinatarios configurados.
-- Un colegio por correo; hoy solo hay uno afiliado.
create or replace function private.send_teacher_daily_report()
returns void
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_api_key text := private.get_app_setting('resend_api_key');
  v_from text := coalesce(private.get_app_setting('resend_from_address'), 'no-reply@mail.resendcegmas.com');
  v_to text := coalesce(private.get_app_setting('teacher_report_emails'), 'Cegmas@outlook.com');
  v_today date := (now() at time zone 'America/Santo_Domingo')::date;
  v_school record;
  v_text text;
begin
  if v_api_key is null or v_api_key = '' then
    raise warning 'resend_api_key no configurado: no se envía el informe docente.';
    return;
  end if;

  for v_school in select id, name from schools where deleted_at is null loop
    v_text := private.teacher_daily_report(v_school.id, v_today);

    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_api_key
      ),
      body := jsonb_build_object(                   -- jsonb, NUNCA ::text
        'from', 'MentorIApp <' || v_from || '>',
        'to', to_jsonb(regexp_split_to_array(regexp_replace(v_to, '\s', '', 'g'), ',')),
        'subject', 'Seguimiento docente ' || to_char(v_today, 'DD/MM/YYYY') || ' — ' || v_school.name,
        'text', 'Listo para copiar y pegar en WhatsApp:' || E'\n\n' || v_text,
        'html',
          '<div style="font-family:sans-serif;max-width:560px">' ||
          '<p style="color:#64748b;font-size:13px">Listo para copiar y pegar en WhatsApp:</p>' ||
          '<pre style="white-space:pre-wrap;font-family:inherit;font-size:15px;background:#f8fafc;padding:16px;border-radius:8px">' ||
          replace(replace(replace(v_text, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
          '</pre></div>'
      )
    );
  end loop;
end;
$$;

revoke execute on function private.send_teacher_daily_report() from public, anon, authenticated;

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron no disponible (%): el informe no quedó programado.', sqlerrm;
    return;
  end;

  if exists (select 1 from cron.job where jobname = 'informe-docente-diario') then
    perform cron.unschedule('informe-docente-diario');
  end if;

  perform cron.schedule(
    'informe-docente-diario',
    '0 19 * * 1-5',                                  -- 3:00 pm RD, lunes a viernes
    $cron$ select private.send_teacher_daily_report(); $cron$
  );
end $$;
