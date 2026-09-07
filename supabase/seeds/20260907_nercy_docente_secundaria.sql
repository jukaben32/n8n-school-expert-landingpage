-- =========================================================================
-- Correccion puntual de Personal — Nercy Jagelis Rodriguez Rosario
--
-- Contexto:
-- Nercy es psicologa en la ficha de Personal. Ese puesto debe conservarse
-- como `psychologist`; el rol `teacher` es solo para su acceso al sistema,
-- porque ese rol activa la segmentacion por grados en RLS.
--
-- Objetivo:
-- 1. Asegurar que su puesto de Personal sea `psychologist`.
-- 2. Asegurar que, si ya tiene usuario de acceso, su rol de acceso sea
--    `teacher`.
-- 3. Darle acceso a los estudiantes de 1ro. y 3ro. de Secundaria mediante
--    `teacher_assignments.category = 'regular'`.
--
-- Por que `regular`:
-- Las policies de estudiantes, asistencia, actualizaciones, horarios, notas
-- y planificacion usan la categoria regular por defecto. Las categorias
-- `ingles` y `deporte` son para enrutar comunicaciones por area.
--
-- Reejecutable sin duplicar: usa `on conflict do nothing`.
-- =========================================================================

begin;

do $$
declare
    v_school_id uuid := '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e';
    v_staff_id uuid;
begin
    select s.id
      into v_staff_id
      from staff s
     where s.school_id = v_school_id
       and s.deleted_at is null
       and (
            lower(trim(s.email)) = 'nercyrodriguezrosario@gmail.com'
            or (
                lower(trim(s.first_name)) = lower('Nercy Jagelis')
                and lower(trim(s.last_name)) = lower('Rodriguez Rosario')
            )
            or lower(trim(s.first_name || ' ' || s.last_name)) = lower('Nercy Jagelis Rodriguez Rosario')
       )
     order by
       case when lower(trim(s.email)) = 'nercyrodriguezrosario@gmail.com' then 0 else 1 end,
       s.created_at desc
     limit 1;

    if v_staff_id is null then
        raise exception 'No se encontro a Nercy Jagelis Rodriguez Rosario en staff.';
    end if;

    update staff
       set role = 'psychologist',
           updated_at = now()
     where id = v_staff_id
       and role <> 'psychologist';


    update users_profiles
       set role = 'teacher',
           updated_at = now()
     where school_id = v_school_id
       and staff_id = v_staff_id
       and role <> 'teacher';

    insert into teacher_assignments (school_id, staff_id, grade_level, category)
    values
        (v_school_id, v_staff_id, '1ro. Secundaria', 'regular'),
        (v_school_id, v_staff_id, '3ro. Secundaria', 'regular')
    on conflict do nothing;
end $$;

commit;

-- Verificacion recomendada despues de correr el script:
-- select s.id, s.first_name, s.last_name, s.email, s.role as puesto_personal,
--        up.role as access_role,
--        ta.category, ta.grade_level,
--        count(st.id) filter (where st.deleted_at is null) as estudiantes_visibles_en_grado
--   from staff s
--   left join users_profiles up on up.staff_id = s.id and up.school_id = s.school_id
--   left join teacher_assignments ta on ta.staff_id = s.id and ta.category = 'regular'
--   left join students st on st.school_id = s.school_id and st.grade_level = ta.grade_level
--  where s.school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e'
--    and lower(trim(s.email)) = 'nercyrodriguezrosario@gmail.com'
--  group by s.id, s.first_name, s.last_name, s.email, s.role, up.role, ta.category, ta.grade_level
--  order by ta.grade_level;
