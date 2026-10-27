-- DIAGNOSTICO (solo lectura) -- horarios actualizados, oct. 2026.
-- Generado por generar_horarios_actualizados_2026_10.py. Correr ANTES de la carga.
-- Cada bloque es una consulta aparte: el editor de Supabase solo muestra la
-- ultima, asi que se corre un bloque a la vez (seleccionar y ejecutar).

-- A) Docentes: cada llave debe dar EXACTAMENTE 1 persona activa.
--    0 = falta darla de alta en Personal (con su correo real) antes de cargar.
--    2 o mas = ficha duplicada; hay que dejar una sola antes de cargar.
select k.key,
       count(s.id) as coincidencias,
       string_agg(s.first_name || ' ' || s.last_name || ' <' || coalesce(s.email, '') || '>', ' | ') as quien
from (values
    ('casandra', 'casandra%', 'medina%'),
    ('elisa', 'elisa%', 'santana%'),
    ('gary', 'gary%', '%'),
    ('genesis', 'g_nesis%', 'rodr_guez%'),
    ('indira', 'indira%', 'peguero%'),
    ('jsanchez', 'jennifer%', 's_nchez%'),
    ('jsoriano', 'jenn%', 'soriano%'),
    ('juanairis', 'juana iris%', 'severino%'),
    ('manuela', 'manuela%', 'vicente%'),
    ('marcelis', 'marcel%', 'santos%'),
    ('marianelis', 'mar_anelis%', 'rivera%'),
    ('melissa', 'melissa%', '%'),
    ('nercy', 'nercy%', '%'),
    ('nicol', 'nicol%', 'gonz_lez%'),
    ('ruth', 'ruth%', 'mingo%'),
    ('teresa', 'teresa%', 'santana%'),
    ('vianela', 'vianela%', 'santana%'),
    ('yendry', 'yendry%', 'paulino%'),
    ('yucleidy', 'yuc%', 'pozo%')
) as k(key, f, l)
left join staff s on s.school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and s.deleted_at is null
     and s.first_name ilike k.f and s.last_name ilike k.l
group by k.key
order by (count(s.id) = 1), k.key;

-- B) Franjas de primaria y secundaria que la carga espera encontrar (deben salir las 11).
select name, start_time, end_time, level
from class_periods
where school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e'
  and name in ('Bloque 1','Bloque 2','Bloque 3','Bloque 4','Bloque 5',
               'Sec. Bloque 1','Sec. Bloque 2','Sec. Bloque 3','Sec. Bloque 4','Sec. Bloque 5','Sec. Bloque 6')
order by level, sort_order;

-- C) Texto REAL de grade_level en estudiantes inscritos (comparar con la lista que usa la carga:
--    1ro. Primaria ... 6to. Primaria, 1ro. Secundaria ... 6to. Secundaria).
select grade_level, count(*) as inscritos
from students
where school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and deleted_at is null and enrollment_status = 'inscrito'
group by grade_level order by grade_level;

-- D) Clases del horario VIGENTE que la carga dejaria intactas porque el horario nuevo ya
--    no las tiene (no se borran: borrar una clase borraria sus planificaciones).
--    Se muestra despues de cargar; antes de cargar, esto lista todo lo que cambia de docente.
select cs.grade_level, cs.day_of_week, p.name as franja, sj.name as materia,
       st.first_name || ' ' || st.last_name as docente_actual
from class_schedules cs
join class_periods p on p.id = cs.period_id
left join subjects sj on sj.id = cs.subject_id
left join staff st on st.id = cs.staff_id
where cs.school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e'
order by cs.grade_level, cs.day_of_week, p.sort_order
limit 400;
