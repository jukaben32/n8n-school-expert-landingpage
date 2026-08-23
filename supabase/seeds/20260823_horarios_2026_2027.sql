-- Carga de horarios 2026-2027 -- generado automaticamente.
-- Fuente: Horarios_20262027_MentorIApp_corregido.xlsx
begin;

-- 1. Orlando Antoine Natera: docente de Ingles de 1er ciclo de secundaria
--    (area de Ingles/Amco). No existia en `staff`.
insert into staff (id, school_id, first_name, last_name, role, specialty)
values ('b7c1e5a2-9d34-4f68-8a10-3c5e7f2b6d91', '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Orlando Antoine', 'Natera', 'teacher',
        'Inglés (Nivel secundario) primer ciclo')
on conflict (id) do nothing;

-- 2. Catalogo de materias (la tabla estaba vacia).
insert into subjects (school_id, name) select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Biología'
where not exists (select 1 from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Biología');
insert into subjects (school_id, name) select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Caligrafía'
where not exists (select 1 from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Caligrafía');
insert into subjects (school_id, name) select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Ciencias Naturales'
where not exists (select 1 from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales');
insert into subjects (school_id, name) select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Ciencias Sociales'
where not exists (select 1 from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales');
insert into subjects (school_id, name) select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Educación Artística'
where not exists (select 1 from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Artística');
insert into subjects (school_id, name) select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Educación Física'
where not exists (select 1 from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Física');
insert into subjects (school_id, name) select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Formación Humana'
where not exists (select 1 from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana');
insert into subjects (school_id, name) select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Física'
where not exists (select 1 from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Física');
insert into subjects (school_id, name) select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Inglés'
where not exists (select 1 from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés');
insert into subjects (school_id, name) select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Lengua Española'
where not exists (select 1 from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española');
insert into subjects (school_id, name) select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Lengua Española / Caligrafía'
where not exists (select 1 from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española / Caligrafía');
insert into subjects (school_id, name) select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Matemática'
where not exists (select 1 from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática');
insert into subjects (school_id, name) select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Orientación Educativa'
where not exists (select 1 from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Orientación Educativa');
insert into subjects (school_id, name) select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Salida Optativa'
where not exists (select 1 from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Salida Optativa');

-- 3. Las 7 franjas que ya existian son las de primaria.
update class_periods set level='primaria' where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and level is null;

-- 4. Franjas de secundaria (no existian).
insert into class_periods (school_id, name, start_time, end_time, sort_order, level)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Sec. Bloque 1', '07:30', '08:20', 10, 'secundaria'
where not exists (select 1 from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1');
insert into class_periods (school_id, name, start_time, end_time, sort_order, level)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Sec. Bloque 2', '08:20', '09:10', 11, 'secundaria'
where not exists (select 1 from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2');
insert into class_periods (school_id, name, start_time, end_time, sort_order, level)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Sec. Bloque 3', '09:10', '10:00', 12, 'secundaria'
where not exists (select 1 from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3');
insert into class_periods (school_id, name, start_time, end_time, sort_order, level)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Sec. Bloque 4', '10:00', '10:50', 13, 'secundaria'
where not exists (select 1 from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4');
insert into class_periods (school_id, name, start_time, end_time, sort_order, level)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Sec. Recreo', '10:50', '11:10', 14, 'secundaria'
where not exists (select 1 from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Recreo');
insert into class_periods (school_id, name, start_time, end_time, sort_order, level)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Sec. Bloque 5', '11:10', '12:10', 15, 'secundaria'
where not exists (select 1 from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5');
insert into class_periods (school_id, name, start_time, end_time, sort_order, level)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Sec. Bloque 6', '12:10', '13:00', 16, 'secundaria'
where not exists (select 1 from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6');

-- 5. Normalizar grade_level: es el campo que une el horario con cada
--    familia por RLS, asi que una variante de texto deja a esa familia
--    sin ver su horario.
update students set grade_level='6to. Secundaria' where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and grade_level='6to Secundaria';
update teacher_assignments set grade_level='6to. Secundaria' where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and grade_level='6to Secundaria';
update students set grade_level='1ro. Secundaria' where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and grade_level='1ro de Secundaria';
update teacher_assignments set grade_level='1ro. Secundaria' where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and grade_level='1ro de Secundaria';
update students set grade_level='3ro. Primaria' where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and grade_level='3r0. Primaria';
update teacher_assignments set grade_level='3ro. Primaria' where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and grade_level='3r0. Primaria';
update students set grade_level='4to. Primaria' where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and grade_level='4to. de Primaria';
update teacher_assignments set grade_level='4to. Primaria' where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and grade_level='4to. de Primaria';

-- 6. El horario: 330 clases.
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='b7c1e5a2-9d34-4f68-8a10-3c5e7f2b6d91')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='b7c1e5a2-9d34-4f68-8a10-3c5e7f2b6d91')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Artística'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='b7c1e5a2-9d34-4f68-8a10-3c5e7f2b6d91')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Física'),
       (select id from staff where id='062d636e-cf17-44fc-b09d-1bb5d6d12564')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='b7c1e5a2-9d34-4f68-8a10-3c5e7f2b6d91')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='b7c1e5a2-9d34-4f68-8a10-3c5e7f2b6d91')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Orientación Educativa'),
       (select id from staff where id='0d5ed330-5733-49d2-a20c-2a60189decdd')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='b7c1e5a2-9d34-4f68-8a10-3c5e7f2b6d91')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='b7c1e5a2-9d34-4f68-8a10-3c5e7f2b6d91')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Artística'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Artística'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='b7c1e5a2-9d34-4f68-8a10-3c5e7f2b6d91')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Física'),
       (select id from staff where id='062d636e-cf17-44fc-b09d-1bb5d6d12564')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Física'),
       (select id from staff where id='062d636e-cf17-44fc-b09d-1bb5d6d12564')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='b7c1e5a2-9d34-4f68-8a10-3c5e7f2b6d91')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='b7c1e5a2-9d34-4f68-8a10-3c5e7f2b6d91')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Física'),
       (select id from staff where id='062d636e-cf17-44fc-b09d-1bb5d6d12564')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='b7c1e5a2-9d34-4f68-8a10-3c5e7f2b6d91')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='b7c1e5a2-9d34-4f68-8a10-3c5e7f2b6d91')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='b7c1e5a2-9d34-4f68-8a10-3c5e7f2b6d91')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='b7c1e5a2-9d34-4f68-8a10-3c5e7f2b6d91')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='b7c1e5a2-9d34-4f68-8a10-3c5e7f2b6d91')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Artística'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Artística'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='5a0a9bbc-5ac5-4e0c-a7e9-05f82f835266')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Biología'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Biología'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Biología'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Salida Optativa'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Biología'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='532753e7-ecb4-4168-bea8-e8dcfc4834b0')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Artística'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='532753e7-ecb4-4168-bea8-e8dcfc4834b0')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='532753e7-ecb4-4168-bea8-e8dcfc4834b0')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Física'),
       (select id from staff where id='062d636e-cf17-44fc-b09d-1bb5d6d12564')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Orientación Educativa'),
       (select id from staff where id='0d5ed330-5733-49d2-a20c-2a60189decdd')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Salida Optativa'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='532753e7-ecb4-4168-bea8-e8dcfc4834b0')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='532753e7-ecb4-4168-bea8-e8dcfc4834b0')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='532753e7-ecb4-4168-bea8-e8dcfc4834b0')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='532753e7-ecb4-4168-bea8-e8dcfc4834b0')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Salida Optativa'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Física'),
       (select id from staff where id='062d636e-cf17-44fc-b09d-1bb5d6d12564')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Salida Optativa'),
       (select id from staff where id='a58fe2dc-5829-482c-9334-8376e5b45bfe')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='7e93f0b7-8340-44b9-b20e-2275318b477b')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='532753e7-ecb4-4168-bea8-e8dcfc4834b0')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Artística'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='532753e7-ecb4-4168-bea8-e8dcfc4834b0')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='532753e7-ecb4-4168-bea8-e8dcfc4834b0')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='532753e7-ecb4-4168-bea8-e8dcfc4834b0')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Salida Optativa'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='532753e7-ecb4-4168-bea8-e8dcfc4834b0')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='532753e7-ecb4-4168-bea8-e8dcfc4834b0')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Salida Optativa'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='532753e7-ecb4-4168-bea8-e8dcfc4834b0')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='532753e7-ecb4-4168-bea8-e8dcfc4834b0')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Artística'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='ad45e58b-9a0f-4a01-b17a-224ac6402ab2')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Física'),
       (select id from staff where id='062d636e-cf17-44fc-b09d-1bb5d6d12564')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Artística'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Física'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Física'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Física'),
       (select id from staff where id='263f34b8-673d-40ad-b827-203ee2a6a7da')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       (select id from staff where id='15124231-2a22-4e79-933b-ce3671dd5f1c')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Secundaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Sec. Bloque 6'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='cc833d1d-cbce-4182-b6be-ce2a9714bd52')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Física'),
       (select id from staff where id='062d636e-cf17-44fc-b09d-1bb5d6d12564')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='8943000e-41d5-447a-9480-427cb5e23c94')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española / Caligrafía'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='8943000e-41d5-447a-9480-427cb5e23c94')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española / Caligrafía'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='8943000e-41d5-447a-9480-427cb5e23c94')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Artística'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='8943000e-41d5-447a-9480-427cb5e23c94')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='6aeaf7f5-b9f3-46c5-b2dc-cee91da758f5')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '1ro. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='8943000e-41d5-447a-9480-427cb5e23c94')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='8943000e-41d5-447a-9480-427cb5e23c94')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Física'),
       (select id from staff where id='062d636e-cf17-44fc-b09d-1bb5d6d12564')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='8943000e-41d5-447a-9480-427cb5e23c94')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española / Caligrafía'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='8943000e-41d5-447a-9480-427cb5e23c94')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española / Caligrafía'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='8943000e-41d5-447a-9480-427cb5e23c94')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Artística'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='8943000e-41d5-447a-9480-427cb5e23c94')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '2do. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='9aec518a-4c6f-4fd7-bf3b-f09574be7333')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Física'),
       (select id from staff where id='062d636e-cf17-44fc-b09d-1bb5d6d12564')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='8943000e-41d5-447a-9480-427cb5e23c94')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='8943000e-41d5-447a-9480-427cb5e23c94')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Artística'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española / Caligrafía'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='8943000e-41d5-447a-9480-427cb5e23c94')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='8943000e-41d5-447a-9480-427cb5e23c94')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='8943000e-41d5-447a-9480-427cb5e23c94')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '3ro. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       (select id from staff where id='c46118c5-e38d-43f4-b907-1c69aed4c9e7')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='47e2602b-0544-4d73-85c9-9482b8db5c18')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española / Caligrafía'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Caligrafía'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Física'),
       (select id from staff where id='062d636e-cf17-44fc-b09d-1bb5d6d12564')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='47e2602b-0544-4d73-85c9-9482b8db5c18')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='47e2602b-0544-4d73-85c9-9482b8db5c18')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Artística'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='47e2602b-0544-4d73-85c9-9482b8db5c18')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='47e2602b-0544-4d73-85c9-9482b8db5c18')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española / Caligrafía'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '4to. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='21f58700-5951-49f6-90b7-18f3de6b6759')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Física'),
       (select id from staff where id='062d636e-cf17-44fc-b09d-1bb5d6d12564')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='47e2602b-0544-4d73-85c9-9482b8db5c18')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='47e2602b-0544-4d73-85c9-9482b8db5c18')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española / Caligrafía'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='47e2602b-0544-4d73-85c9-9482b8db5c18')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='47e2602b-0544-4d73-85c9-9482b8db5c18')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='47e2602b-0544-4d73-85c9-9482b8db5c18')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española / Caligrafía'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Artística'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='47e2602b-0544-4d73-85c9-9482b8db5c18')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '5to. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       (select id from staff where id='2a74c703-2d99-48d5-979f-dffbd3e07631')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='47e2602b-0544-4d73-85c9-9482b8db5c18')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Física'),
       (select id from staff where id='062d636e-cf17-44fc-b09d-1bb5d6d12564')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 1'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='47e2602b-0544-4d73-85c9-9482b8db5c18')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española / Caligrafía'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='47e2602b-0544-4d73-85c9-9482b8db5c18')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 2'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='47e2602b-0544-4d73-85c9-9482b8db5c18')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 3'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Matemática'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Sociales'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 4'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Inglés'),
       (select id from staff where id='47e2602b-0544-4d73-85c9-9482b8db5c18')
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 1,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Educación Artística'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 2,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 3,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ciencias Naturales'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 4,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Lengua Española'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();
insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', '6to. Primaria', 5,
       (select id from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Bloque 5'),
       (select id from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Formación Humana'),
       null
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id=excluded.subject_id, staff_id=excluded.staff_id, updated_at=now();

commit;