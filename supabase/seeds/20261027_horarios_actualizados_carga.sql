-- CARGA de horarios actualizados 2026-2027 (oct. 2026) -- generado automaticamente.
-- Cambios: docentes nuevos (Melissa, Gary, Casandra, Elisa, Nicol...), salida de
-- Orlando Natera / Gabriela Lugo / Juana Alcantara / Alejandrina Lake / Diarkis Leon.
-- 150 clases de Primaria + 180 de Secundaria, cruzadas hoja de grado vs hoja de docente.
--
-- Que hace: ACTUALIZA en sitio (upsert por colegio+grado+dia+franja). NO borra clases
-- (class_schedules tiene lesson_plans colgando con on delete cascade). Si una clase del
-- horario viejo ya no existe en el nuevo, queda como esta y la consulta final la lista.
-- NO crea personal: las personas nuevas se dan de alta en Personal con su correo real
-- ANTES (el diagnostico A dice quien falta). Si falta o esta duplicada, aborta sin tocar nada.
-- Reejecutable sin riesgo.
begin;

create temp table _doc (key text, staff_id uuid) on commit drop;
insert into _doc (key, staff_id)
select k.key, s.id
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
    ('nicol', 'nicol%', 'gonz_lez%'),
    ('ruth', 'ruth%', 'mingo%'),
    ('teresa', 'teresa%', 'santana%'),
    ('vianela', 'vianela%', 'santana%'),
    ('yendry', 'yendry%', 'paulino%'),
    ('yucleidy', 'yuc%', 'pozo%')
) as k(key, f, l)
join staff s on s.school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and s.deleted_at is null
     and s.first_name ilike k.f and s.last_name ilike k.l;

do $$
declare malos text;
begin
  select string_agg(k || ' (' || n || ')', ', ') into malos from (
    select k.key as k, count(d.staff_id) as n
    from (values ('casandra'), ('elisa'), ('gary'), ('genesis'), ('indira'), ('jsanchez'), ('jsoriano'), ('juanairis'), ('manuela'), ('marcelis'), ('marianelis'), ('melissa'), ('nicol'), ('ruth'), ('teresa'), ('vianela'), ('yendry'), ('yucleidy')) as k(key)
    left join _doc d on d.key = k.key
    group by k.key having count(d.staff_id) <> 1) x;
  if malos is not null then
    raise exception 'Docentes sin ficha unica en Personal (llave y coincidencias): %. Correr el diagnostico A y corregir.', malos;
  end if;
end $$;

-- Materia: la optativa pasa a llamarse como dice la estadistica del colegio (mismo id,
-- asi no se rompen notas ni horarios que ya la usan).
update subjects set name = 'Salida Optativa (Matemática aplicada a la tecnología)'
where school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name = 'Salida Optativa';
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
insert into subjects (school_id, name) select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Salida Optativa (Matemática aplicada a la tecnología)'
where not exists (select 1 from subjects where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Salida Optativa (Matemática aplicada a la tecnología)');

create temp table _nuevo (grade text, dia int, periodo text, materia text, doc text) on commit drop;
insert into _nuevo values
('1ro. Primaria', 1, 'Bloque 1', 'Inglés', 'marianelis'),
('1ro. Primaria', 2, 'Bloque 1', 'Educación Física', 'jsoriano'),
('1ro. Primaria', 3, 'Bloque 1', 'Lengua Española', 'vianela'),
('1ro. Primaria', 4, 'Bloque 1', 'Lengua Española', 'vianela'),
('1ro. Primaria', 5, 'Bloque 1', 'Ciencias Naturales', 'vianela'),
('1ro. Primaria', 1, 'Bloque 2', 'Inglés', 'marianelis'),
('1ro. Primaria', 2, 'Bloque 2', 'Matemática', 'vianela'),
('1ro. Primaria', 3, 'Bloque 2', 'Lengua Española / Caligrafía', 'vianela'),
('1ro. Primaria', 4, 'Bloque 2', 'Lengua Española', 'vianela'),
('1ro. Primaria', 5, 'Bloque 2', 'Matemática', 'vianela'),
('1ro. Primaria', 1, 'Bloque 3', 'Lengua Española / Caligrafía', 'vianela'),
('1ro. Primaria', 2, 'Bloque 3', 'Ciencias Naturales', 'vianela'),
('1ro. Primaria', 3, 'Bloque 3', 'Formación Humana', 'vianela'),
('1ro. Primaria', 4, 'Bloque 3', 'Matemática', 'vianela'),
('1ro. Primaria', 5, 'Bloque 3', 'Educación Artística', 'vianela'),
('1ro. Primaria', 1, 'Bloque 4', 'Matemática', 'vianela'),
('1ro. Primaria', 2, 'Bloque 4', 'Ciencias Sociales', 'vianela'),
('1ro. Primaria', 3, 'Bloque 4', 'Inglés', 'marianelis'),
('1ro. Primaria', 4, 'Bloque 4', 'Matemática', 'vianela'),
('1ro. Primaria', 5, 'Bloque 4', 'Inglés', 'marianelis'),
('1ro. Primaria', 1, 'Bloque 5', 'Matemática', 'vianela'),
('1ro. Primaria', 2, 'Bloque 5', 'Ciencias Sociales', 'vianela'),
('1ro. Primaria', 3, 'Bloque 5', 'Ciencias Naturales', 'vianela'),
('1ro. Primaria', 4, 'Bloque 5', 'Caligrafía', 'vianela'),
('1ro. Primaria', 5, 'Bloque 5', 'Inglés', 'marianelis'),
('2do. Primaria', 1, 'Bloque 1', 'Lengua Española', 'indira'),
('2do. Primaria', 2, 'Bloque 1', 'Matemática', 'indira'),
('2do. Primaria', 3, 'Bloque 1', 'Ciencias Naturales', 'indira'),
('2do. Primaria', 4, 'Bloque 1', 'Matemática', 'indira'),
('2do. Primaria', 5, 'Bloque 1', 'Inglés', 'marianelis'),
('2do. Primaria', 1, 'Bloque 2', 'Educación Física', 'jsoriano'),
('2do. Primaria', 2, 'Bloque 2', 'Matemática', 'indira'),
('2do. Primaria', 3, 'Bloque 2', 'Ciencias Naturales', 'indira'),
('2do. Primaria', 4, 'Bloque 2', 'Matemática', 'indira'),
('2do. Primaria', 5, 'Bloque 2', 'Inglés', 'marianelis'),
('2do. Primaria', 1, 'Bloque 3', 'Lengua Española / Caligrafía', 'indira'),
('2do. Primaria', 2, 'Bloque 3', 'Formación Humana', 'indira'),
('2do. Primaria', 3, 'Bloque 3', 'Inglés', 'marianelis'),
('2do. Primaria', 4, 'Bloque 3', 'Ciencias Naturales', 'indira'),
('2do. Primaria', 5, 'Bloque 3', 'Lengua Española', 'indira'),
('2do. Primaria', 1, 'Bloque 4', 'Ciencias Sociales', 'indira'),
('2do. Primaria', 2, 'Bloque 4', 'Ciencias Sociales', 'indira'),
('2do. Primaria', 3, 'Bloque 4', 'Lengua Española', 'indira'),
('2do. Primaria', 4, 'Bloque 4', 'Ciencias Naturales', 'indira'),
('2do. Primaria', 5, 'Bloque 4', 'Lengua Española / Caligrafía', 'indira'),
('2do. Primaria', 1, 'Bloque 5', 'Ciencias Sociales', 'indira'),
('2do. Primaria', 2, 'Bloque 5', 'Inglés', 'marianelis'),
('2do. Primaria', 3, 'Bloque 5', 'Educación Artística', 'indira'),
('2do. Primaria', 4, 'Bloque 5', 'Inglés', 'marianelis'),
('2do. Primaria', 5, 'Bloque 5', 'Matemática', 'indira'),
('3ro. Primaria', 1, 'Bloque 1', 'Educación Física', 'jsoriano'),
('3ro. Primaria', 2, 'Bloque 1', 'Inglés', 'marianelis'),
('3ro. Primaria', 3, 'Bloque 1', 'Matemática', 'manuela'),
('3ro. Primaria', 4, 'Bloque 1', 'Lengua Española', 'manuela'),
('3ro. Primaria', 5, 'Bloque 1', 'Matemática', 'manuela'),
('3ro. Primaria', 1, 'Bloque 2', 'Lengua Española', 'manuela'),
('3ro. Primaria', 2, 'Bloque 2', 'Inglés', 'marianelis'),
('3ro. Primaria', 3, 'Bloque 2', 'Matemática', 'manuela'),
('3ro. Primaria', 4, 'Bloque 2', 'Inglés', 'marianelis'),
('3ro. Primaria', 5, 'Bloque 2', 'Educación Artística', 'manuela'),
('3ro. Primaria', 1, 'Bloque 3', 'Lengua Española / Caligrafía', 'manuela'),
('3ro. Primaria', 2, 'Bloque 3', 'Ciencias Sociales', 'manuela'),
('3ro. Primaria', 3, 'Bloque 3', 'Matemática', 'manuela'),
('3ro. Primaria', 4, 'Bloque 3', 'Inglés', 'marianelis'),
('3ro. Primaria', 5, 'Bloque 3', 'Inglés', 'marianelis'),
('3ro. Primaria', 1, 'Bloque 4', 'Ciencias Sociales', 'manuela'),
('3ro. Primaria', 2, 'Bloque 4', 'Matemática', 'manuela'),
('3ro. Primaria', 3, 'Bloque 4', 'Ciencias Naturales', 'manuela'),
('3ro. Primaria', 4, 'Bloque 4', 'Lengua Española', 'manuela'),
('3ro. Primaria', 5, 'Bloque 4', 'Ciencias Naturales', 'manuela'),
('3ro. Primaria', 1, 'Bloque 5', 'Ciencias Sociales', 'manuela'),
('3ro. Primaria', 2, 'Bloque 5', 'Matemática', 'manuela'),
('3ro. Primaria', 3, 'Bloque 5', 'Ciencias Naturales', 'manuela'),
('3ro. Primaria', 4, 'Bloque 5', 'Ciencias Naturales', 'manuela'),
('3ro. Primaria', 5, 'Bloque 5', 'Formación Humana', 'manuela'),
('4to. Primaria', 1, 'Bloque 1', 'Lengua Española', 'teresa'),
('4to. Primaria', 2, 'Bloque 1', 'Ciencias Sociales', 'teresa'),
('4to. Primaria', 3, 'Bloque 1', 'Inglés', 'marianelis'),
('4to. Primaria', 4, 'Bloque 1', 'Formación Humana', 'teresa'),
('4to. Primaria', 5, 'Bloque 1', 'Lengua Española / Caligrafía', 'teresa'),
('4to. Primaria', 1, 'Bloque 2', 'Caligrafía', 'teresa'),
('4to. Primaria', 2, 'Bloque 2', 'Educación Física', 'jsoriano'),
('4to. Primaria', 3, 'Bloque 2', 'Inglés', 'marianelis'),
('4to. Primaria', 4, 'Bloque 2', 'Matemática', 'teresa'),
('4to. Primaria', 5, 'Bloque 2', 'Lengua Española', 'teresa'),
('4to. Primaria', 1, 'Bloque 3', 'Ciencias Naturales', 'teresa'),
('4to. Primaria', 2, 'Bloque 3', 'Inglés', 'marianelis'),
('4to. Primaria', 3, 'Bloque 3', 'Educación Artística', 'teresa'),
('4to. Primaria', 4, 'Bloque 3', 'Matemática', 'teresa'),
('4to. Primaria', 5, 'Bloque 3', 'Ciencias Sociales', 'teresa'),
('4to. Primaria', 1, 'Bloque 4', 'Matemática', 'teresa'),
('4to. Primaria', 2, 'Bloque 4', 'Inglés', 'marianelis'),
('4to. Primaria', 3, 'Bloque 4', 'Ciencias Naturales', 'teresa'),
('4to. Primaria', 4, 'Bloque 4', 'Inglés', 'marianelis'),
('4to. Primaria', 5, 'Bloque 4', 'Ciencias Sociales', 'teresa'),
('4to. Primaria', 1, 'Bloque 5', 'Matemática', 'teresa'),
('4to. Primaria', 2, 'Bloque 5', 'Lengua Española / Caligrafía', 'teresa'),
('4to. Primaria', 3, 'Bloque 5', 'Ciencias Naturales', 'teresa'),
('4to. Primaria', 4, 'Bloque 5', 'Ciencias Sociales', 'teresa'),
('4to. Primaria', 5, 'Bloque 5', 'Ciencias Naturales', 'teresa'),
('5to. Primaria', 1, 'Bloque 1', 'Lengua Española', 'juanairis'),
('5to. Primaria', 2, 'Bloque 1', 'Matemática', 'juanairis'),
('5to. Primaria', 3, 'Bloque 1', 'Educación Física', 'jsoriano'),
('5to. Primaria', 4, 'Bloque 1', 'Inglés', 'melissa'),
('5to. Primaria', 5, 'Bloque 1', 'Matemática', 'juanairis'),
('5to. Primaria', 1, 'Bloque 2', 'Ciencias Sociales', 'juanairis'),
('5to. Primaria', 2, 'Bloque 2', 'Lengua Española / Caligrafía', 'juanairis'),
('5to. Primaria', 3, 'Bloque 2', 'Ciencias Naturales', 'juanairis'),
('5to. Primaria', 4, 'Bloque 2', 'Lengua Española', 'juanairis'),
('5to. Primaria', 5, 'Bloque 2', 'Matemática', 'juanairis'),
('5to. Primaria', 1, 'Bloque 3', 'Inglés', 'melissa'),
('5to. Primaria', 2, 'Bloque 3', 'Inglés', 'melissa'),
('5to. Primaria', 3, 'Bloque 3', 'Ciencias Naturales', 'juanairis'),
('5to. Primaria', 4, 'Bloque 3', 'Inglés', 'melissa'),
('5to. Primaria', 5, 'Bloque 3', 'Ciencias Sociales', 'juanairis'),
('5to. Primaria', 1, 'Bloque 4', 'Ciencias Sociales', 'juanairis'),
('5to. Primaria', 2, 'Bloque 4', 'Inglés', 'melissa'),
('5to. Primaria', 3, 'Bloque 4', 'Matemática', 'juanairis'),
('5to. Primaria', 4, 'Bloque 4', 'Ciencias Naturales', 'juanairis'),
('5to. Primaria', 5, 'Bloque 4', 'Lengua Española / Caligrafía', 'juanairis'),
('5to. Primaria', 1, 'Bloque 5', 'Educación Artística', 'juanairis'),
('5to. Primaria', 2, 'Bloque 5', 'Formación Humana', 'juanairis'),
('5to. Primaria', 3, 'Bloque 5', 'Matemática', 'juanairis'),
('5to. Primaria', 4, 'Bloque 5', 'Ciencias Sociales', 'juanairis'),
('5to. Primaria', 5, 'Bloque 5', 'Lengua Española', 'juanairis'),
('6to. Primaria', 1, 'Bloque 1', 'Inglés', 'melissa'),
('6to. Primaria', 2, 'Bloque 1', 'Matemática', 'nicol'),
('6to. Primaria', 3, 'Bloque 1', 'Lengua Española', 'nicol'),
('6to. Primaria', 4, 'Bloque 1', 'Educación Física', 'jsoriano'),
('6to. Primaria', 5, 'Bloque 1', 'Ciencias Sociales', 'nicol'),
('6to. Primaria', 1, 'Bloque 2', 'Inglés', 'melissa'),
('6to. Primaria', 2, 'Bloque 2', 'Matemática', 'nicol'),
('6to. Primaria', 3, 'Bloque 2', 'Lengua Española / Caligrafía', 'nicol'),
('6to. Primaria', 4, 'Bloque 2', 'Inglés', 'melissa'),
('6to. Primaria', 5, 'Bloque 2', 'Ciencias Sociales', 'nicol'),
('6to. Primaria', 1, 'Bloque 3', 'Ciencias Naturales', 'nicol'),
('6to. Primaria', 2, 'Bloque 3', 'Matemática', 'nicol'),
('6to. Primaria', 3, 'Bloque 3', 'Matemática', 'nicol'),
('6to. Primaria', 4, 'Bloque 3', 'Lengua Española', 'nicol'),
('6to. Primaria', 5, 'Bloque 3', 'Matemática', 'nicol'),
('6to. Primaria', 1, 'Bloque 4', 'Ciencias Naturales', 'nicol'),
('6to. Primaria', 2, 'Bloque 4', 'Lengua Española', 'nicol'),
('6to. Primaria', 3, 'Bloque 4', 'Ciencias Sociales', 'nicol'),
('6to. Primaria', 4, 'Bloque 4', 'Inglés', 'melissa'),
('6to. Primaria', 5, 'Bloque 4', 'Inglés', 'melissa'),
('6to. Primaria', 1, 'Bloque 5', 'Educación Artística', 'nicol'),
('6to. Primaria', 2, 'Bloque 5', 'Ciencias Naturales', 'nicol'),
('6to. Primaria', 3, 'Bloque 5', 'Ciencias Naturales', 'nicol'),
('6to. Primaria', 4, 'Bloque 5', 'Lengua Española', 'nicol'),
('6to. Primaria', 5, 'Bloque 5', 'Formación Humana', 'nicol'),
('1ro. Secundaria', 1, 'Sec. Bloque 1', 'Lengua Española', 'yucleidy'),
('1ro. Secundaria', 2, 'Sec. Bloque 1', 'Ciencias Sociales', 'casandra'),
('1ro. Secundaria', 3, 'Sec. Bloque 1', 'Ciencias Naturales', 'marcelis'),
('1ro. Secundaria', 4, 'Sec. Bloque 1', 'Ciencias Sociales', 'casandra'),
('1ro. Secundaria', 5, 'Sec. Bloque 1', 'Orientación Educativa', 'genesis'),
('1ro. Secundaria', 1, 'Sec. Bloque 2', 'Lengua Española', 'yucleidy'),
('1ro. Secundaria', 2, 'Sec. Bloque 2', 'Ciencias Sociales', 'casandra'),
('1ro. Secundaria', 3, 'Sec. Bloque 2', 'Matemática', 'jsanchez'),
('1ro. Secundaria', 4, 'Sec. Bloque 2', 'Ciencias Naturales', 'marcelis'),
('1ro. Secundaria', 5, 'Sec. Bloque 2', 'Ciencias Sociales', 'casandra'),
('1ro. Secundaria', 1, 'Sec. Bloque 3', 'Matemática', 'jsanchez'),
('1ro. Secundaria', 2, 'Sec. Bloque 3', 'Formación Humana', 'ruth'),
('1ro. Secundaria', 3, 'Sec. Bloque 3', 'Inglés', 'melissa'),
('1ro. Secundaria', 4, 'Sec. Bloque 3', 'Matemática', 'jsanchez'),
('1ro. Secundaria', 5, 'Sec. Bloque 3', 'Educación Artística', 'yucleidy'),
('1ro. Secundaria', 1, 'Sec. Bloque 4', 'Matemática', 'jsanchez'),
('1ro. Secundaria', 2, 'Sec. Bloque 4', 'Ciencias Naturales', 'marcelis'),
('1ro. Secundaria', 3, 'Sec. Bloque 4', 'Inglés', 'melissa'),
('1ro. Secundaria', 4, 'Sec. Bloque 4', 'Matemática', 'jsanchez'),
('1ro. Secundaria', 5, 'Sec. Bloque 4', 'Formación Humana', 'ruth'),
('1ro. Secundaria', 1, 'Sec. Bloque 5', 'Educación Física', 'jsoriano'),
('1ro. Secundaria', 2, 'Sec. Bloque 5', 'Ciencias Naturales', 'marcelis'),
('1ro. Secundaria', 3, 'Sec. Bloque 5', 'Lengua Española', 'yucleidy'),
('1ro. Secundaria', 4, 'Sec. Bloque 5', 'Lengua Española', 'yucleidy'),
('1ro. Secundaria', 5, 'Sec. Bloque 5', 'Matemática', 'jsanchez'),
('1ro. Secundaria', 1, 'Sec. Bloque 6', 'Inglés', 'melissa'),
('1ro. Secundaria', 2, 'Sec. Bloque 6', 'Inglés', 'melissa'),
('1ro. Secundaria', 3, 'Sec. Bloque 6', 'Lengua Española', 'yucleidy'),
('1ro. Secundaria', 4, 'Sec. Bloque 6', 'Lengua Española', 'yucleidy'),
('1ro. Secundaria', 5, 'Sec. Bloque 6', 'Orientación Educativa', 'genesis'),
('2do. Secundaria', 1, 'Sec. Bloque 1', 'Ciencias Sociales', 'casandra'),
('2do. Secundaria', 2, 'Sec. Bloque 1', 'Inglés', 'melissa'),
('2do. Secundaria', 3, 'Sec. Bloque 1', 'Ciencias Sociales', 'casandra'),
('2do. Secundaria', 4, 'Sec. Bloque 1', 'Matemática', 'jsanchez'),
('2do. Secundaria', 5, 'Sec. Bloque 1', 'Lengua Española', 'yucleidy'),
('2do. Secundaria', 1, 'Sec. Bloque 2', 'Ciencias Sociales', 'casandra'),
('2do. Secundaria', 2, 'Sec. Bloque 2', 'Formación Humana', 'ruth'),
('2do. Secundaria', 3, 'Sec. Bloque 2', 'Ciencias Sociales', 'casandra'),
('2do. Secundaria', 4, 'Sec. Bloque 2', 'Matemática', 'jsanchez'),
('2do. Secundaria', 5, 'Sec. Bloque 2', 'Formación Humana', 'ruth'),
('2do. Secundaria', 1, 'Sec. Bloque 3', 'Lengua Española', 'yucleidy'),
('2do. Secundaria', 2, 'Sec. Bloque 3', 'Ciencias Naturales', 'marcelis'),
('2do. Secundaria', 3, 'Sec. Bloque 3', 'Lengua Española', 'yucleidy'),
('2do. Secundaria', 4, 'Sec. Bloque 3', 'Ciencias Naturales', 'marcelis'),
('2do. Secundaria', 5, 'Sec. Bloque 3', 'Inglés', 'melissa'),
('2do. Secundaria', 1, 'Sec. Bloque 4', 'Lengua Española', 'yucleidy'),
('2do. Secundaria', 2, 'Sec. Bloque 4', 'Educación Artística', 'ruth'),
('2do. Secundaria', 3, 'Sec. Bloque 4', 'Lengua Española', 'yucleidy'),
('2do. Secundaria', 4, 'Sec. Bloque 4', 'Educación Artística', 'ruth'),
('2do. Secundaria', 5, 'Sec. Bloque 4', 'Ciencias Naturales', 'marcelis'),
('2do. Secundaria', 1, 'Sec. Bloque 5', 'Inglés', 'melissa'),
('2do. Secundaria', 2, 'Sec. Bloque 5', 'Matemática', 'jsanchez'),
('2do. Secundaria', 3, 'Sec. Bloque 5', 'Educación Física', 'jsoriano'),
('2do. Secundaria', 4, 'Sec. Bloque 5', 'Ciencias Naturales', 'marcelis'),
('2do. Secundaria', 5, 'Sec. Bloque 5', 'Lengua Española', 'yucleidy'),
('2do. Secundaria', 1, 'Sec. Bloque 6', 'Educación Física', 'jsoriano'),
('2do. Secundaria', 2, 'Sec. Bloque 6', 'Matemática', 'jsanchez'),
('2do. Secundaria', 3, 'Sec. Bloque 6', 'Inglés', 'melissa'),
('2do. Secundaria', 4, 'Sec. Bloque 6', 'Inglés', 'melissa'),
('2do. Secundaria', 5, 'Sec. Bloque 6', 'Matemática', 'jsanchez'),
('3ro. Secundaria', 1, 'Sec. Bloque 1', 'Matemática', 'jsanchez'),
('3ro. Secundaria', 2, 'Sec. Bloque 1', 'Ciencias Naturales', 'marcelis'),
('3ro. Secundaria', 3, 'Sec. Bloque 1', 'Lengua Española', 'yucleidy'),
('3ro. Secundaria', 4, 'Sec. Bloque 1', 'Lengua Española', 'yucleidy'),
('3ro. Secundaria', 5, 'Sec. Bloque 1', 'Ciencias Sociales', 'casandra'),
('3ro. Secundaria', 1, 'Sec. Bloque 2', 'Matemática', 'jsanchez'),
('3ro. Secundaria', 2, 'Sec. Bloque 2', 'Ciencias Naturales', 'marcelis'),
('3ro. Secundaria', 3, 'Sec. Bloque 2', 'Educación Física', 'jsoriano'),
('3ro. Secundaria', 4, 'Sec. Bloque 2', 'Lengua Española', 'yucleidy'),
('3ro. Secundaria', 5, 'Sec. Bloque 2', 'Inglés', 'yendry'),
('3ro. Secundaria', 1, 'Sec. Bloque 3', 'Formación Humana', 'ruth'),
('3ro. Secundaria', 2, 'Sec. Bloque 3', 'Lengua Española', 'yucleidy'),
('3ro. Secundaria', 3, 'Sec. Bloque 3', 'Matemática', 'jsanchez'),
('3ro. Secundaria', 4, 'Sec. Bloque 3', 'Formación Humana', 'ruth'),
('3ro. Secundaria', 5, 'Sec. Bloque 3', 'Ciencias Sociales', 'casandra'),
('3ro. Secundaria', 1, 'Sec. Bloque 4', 'Inglés', 'yendry'),
('3ro. Secundaria', 2, 'Sec. Bloque 4', 'Inglés', 'yendry'),
('3ro. Secundaria', 3, 'Sec. Bloque 4', 'Matemática', 'jsanchez'),
('3ro. Secundaria', 4, 'Sec. Bloque 4', 'Inglés', 'yendry'),
('3ro. Secundaria', 5, 'Sec. Bloque 4', 'Matemática', 'jsanchez'),
('3ro. Secundaria', 1, 'Sec. Bloque 5', 'Educación Artística', 'ruth'),
('3ro. Secundaria', 2, 'Sec. Bloque 5', 'Inglés', 'yendry'),
('3ro. Secundaria', 3, 'Sec. Bloque 5', 'Ciencias Sociales', 'casandra'),
('3ro. Secundaria', 4, 'Sec. Bloque 5', 'Educación Artística', 'ruth'),
('3ro. Secundaria', 5, 'Sec. Bloque 5', 'Ciencias Naturales', 'marcelis'),
('3ro. Secundaria', 1, 'Sec. Bloque 6', 'Lengua Española', 'yucleidy'),
('3ro. Secundaria', 2, 'Sec. Bloque 6', 'Lengua Española', 'yucleidy'),
('3ro. Secundaria', 3, 'Sec. Bloque 6', 'Ciencias Sociales', 'casandra'),
('3ro. Secundaria', 4, 'Sec. Bloque 6', 'Matemática', 'jsanchez'),
('3ro. Secundaria', 5, 'Sec. Bloque 6', 'Ciencias Naturales', 'marcelis'),
('4to. Secundaria', 1, 'Sec. Bloque 1', 'Biología', 'marcelis'),
('4to. Secundaria', 2, 'Sec. Bloque 1', 'Lengua Española', 'elisa'),
('4to. Secundaria', 3, 'Sec. Bloque 1', 'Matemática', 'gary'),
('4to. Secundaria', 4, 'Sec. Bloque 1', 'Lengua Española', 'elisa'),
('4to. Secundaria', 5, 'Sec. Bloque 1', 'Lengua Española', 'elisa'),
('4to. Secundaria', 1, 'Sec. Bloque 2', 'Biología', 'marcelis'),
('4to. Secundaria', 2, 'Sec. Bloque 2', 'Lengua Española', 'elisa'),
('4to. Secundaria', 3, 'Sec. Bloque 2', 'Matemática', 'gary'),
('4to. Secundaria', 4, 'Sec. Bloque 2', 'Lengua Española', 'elisa'),
('4to. Secundaria', 5, 'Sec. Bloque 2', 'Biología', 'marcelis'),
('4to. Secundaria', 1, 'Sec. Bloque 3', 'Ciencias Sociales', 'casandra'),
('4to. Secundaria', 2, 'Sec. Bloque 3', 'Salida Optativa (Matemática aplicada a la tecnología)', 'jsanchez'),
('4to. Secundaria', 3, 'Sec. Bloque 3', 'Biología', 'marcelis'),
('4to. Secundaria', 4, 'Sec. Bloque 3', 'Inglés', 'yendry'),
('4to. Secundaria', 5, 'Sec. Bloque 3', 'Formación Humana', 'ruth'),
('4to. Secundaria', 1, 'Sec. Bloque 4', 'Ciencias Sociales', 'casandra'),
('4to. Secundaria', 2, 'Sec. Bloque 4', 'Matemática', 'gary'),
('4to. Secundaria', 3, 'Sec. Bloque 4', 'Ciencias Sociales', 'casandra'),
('4to. Secundaria', 4, 'Sec. Bloque 4', 'Educación Artística', 'elisa'),
('4to. Secundaria', 5, 'Sec. Bloque 4', 'Inglés', 'yendry'),
('4to. Secundaria', 1, 'Sec. Bloque 5', 'Lengua Española', 'elisa'),
('4to. Secundaria', 2, 'Sec. Bloque 5', 'Matemática', 'gary'),
('4to. Secundaria', 3, 'Sec. Bloque 5', 'Inglés', 'yendry'),
('4to. Secundaria', 4, 'Sec. Bloque 5', 'Educación Física', 'jsoriano'),
('4to. Secundaria', 5, 'Sec. Bloque 5', 'Orientación Educativa', 'genesis'),
('4to. Secundaria', 1, 'Sec. Bloque 6', 'Salida Optativa (Matemática aplicada a la tecnología)', 'jsanchez'),
('4to. Secundaria', 2, 'Sec. Bloque 6', 'Ciencias Sociales', 'casandra'),
('4to. Secundaria', 3, 'Sec. Bloque 6', 'Inglés', 'yendry'),
('4to. Secundaria', 4, 'Sec. Bloque 6', 'Inglés', 'yendry'),
('4to. Secundaria', 5, 'Sec. Bloque 6', 'Matemática', 'gary'),
('5to. Secundaria', 1, 'Sec. Bloque 1', 'Matemática', 'gary'),
('5to. Secundaria', 2, 'Sec. Bloque 1', 'Inglés', 'yendry'),
('5to. Secundaria', 3, 'Sec. Bloque 1', 'Inglés', 'yendry'),
('5to. Secundaria', 4, 'Sec. Bloque 1', 'Ciencias Naturales', 'marcelis'),
('5to. Secundaria', 5, 'Sec. Bloque 1', 'Matemática', 'gary'),
('5to. Secundaria', 1, 'Sec. Bloque 2', 'Matemática', 'gary'),
('5to. Secundaria', 2, 'Sec. Bloque 2', 'Salida Optativa (Matemática aplicada a la tecnología)', 'jsanchez'),
('5to. Secundaria', 3, 'Sec. Bloque 2', 'Ciencias Naturales', 'marcelis'),
('5to. Secundaria', 4, 'Sec. Bloque 2', 'Educación Física', 'jsoriano'),
('5to. Secundaria', 5, 'Sec. Bloque 2', 'Salida Optativa (Matemática aplicada a la tecnología)', 'jsanchez'),
('5to. Secundaria', 1, 'Sec. Bloque 3', 'Ciencias Naturales', 'marcelis'),
('5to. Secundaria', 2, 'Sec. Bloque 3', 'Ciencias Sociales', 'casandra'),
('5to. Secundaria', 3, 'Sec. Bloque 3', 'Lengua Española', 'elisa'),
('5to. Secundaria', 4, 'Sec. Bloque 3', 'Lengua Española', 'elisa'),
('5to. Secundaria', 5, 'Sec. Bloque 3', 'Matemática', 'gary'),
('5to. Secundaria', 1, 'Sec. Bloque 4', 'Ciencias Naturales', 'marcelis'),
('5to. Secundaria', 2, 'Sec. Bloque 4', 'Ciencias Sociales', 'casandra'),
('5to. Secundaria', 3, 'Sec. Bloque 4', 'Lengua Española', 'elisa'),
('5to. Secundaria', 4, 'Sec. Bloque 4', 'Educación Física', 'jsoriano'),
('5to. Secundaria', 5, 'Sec. Bloque 4', 'Lengua Española', 'elisa'),
('5to. Secundaria', 1, 'Sec. Bloque 5', 'Inglés', 'yendry'),
('5to. Secundaria', 2, 'Sec. Bloque 5', 'Lengua Española', 'elisa'),
('5to. Secundaria', 3, 'Sec. Bloque 5', 'Educación Artística', 'ruth'),
('5to. Secundaria', 4, 'Sec. Bloque 5', 'Ciencias Sociales', 'casandra'),
('5to. Secundaria', 5, 'Sec. Bloque 5', 'Inglés', 'yendry'),
('5to. Secundaria', 1, 'Sec. Bloque 6', 'Lengua Española', 'elisa'),
('5to. Secundaria', 2, 'Sec. Bloque 6', 'Matemática', 'gary'),
('5to. Secundaria', 3, 'Sec. Bloque 6', 'Formación Humana', 'ruth'),
('5to. Secundaria', 4, 'Sec. Bloque 6', 'Ciencias Sociales', 'casandra'),
('5to. Secundaria', 5, 'Sec. Bloque 6', 'Inglés', 'yendry'),
('6to. Secundaria', 1, 'Sec. Bloque 1', 'Lengua Española', 'elisa'),
('6to. Secundaria', 2, 'Sec. Bloque 1', 'Matemática', 'gary'),
('6to. Secundaria', 3, 'Sec. Bloque 1', 'Educación Artística', 'ruth'),
('6to. Secundaria', 4, 'Sec. Bloque 1', 'Inglés', 'yendry'),
('6to. Secundaria', 5, 'Sec. Bloque 1', 'Física', 'marcelis'),
('6to. Secundaria', 1, 'Sec. Bloque 2', 'Lengua Española', 'elisa'),
('6to. Secundaria', 2, 'Sec. Bloque 2', 'Inglés', 'yendry'),
('6to. Secundaria', 3, 'Sec. Bloque 2', 'Educación Artística', 'ruth'),
('6to. Secundaria', 4, 'Sec. Bloque 2', 'Inglés', 'yendry'),
('6to. Secundaria', 5, 'Sec. Bloque 2', 'Salida Optativa (Matemática aplicada a la tecnología)', 'gary'),
('6to. Secundaria', 1, 'Sec. Bloque 3', 'Matemática', 'gary'),
('6to. Secundaria', 2, 'Sec. Bloque 3', 'Inglés', 'yendry'),
('6to. Secundaria', 3, 'Sec. Bloque 3', 'Matemática', 'gary'),
('6to. Secundaria', 4, 'Sec. Bloque 3', 'Ciencias Sociales', 'casandra'),
('6to. Secundaria', 5, 'Sec. Bloque 3', 'Inglés', 'yendry'),
('6to. Secundaria', 1, 'Sec. Bloque 4', 'Matemática', 'gary'),
('6to. Secundaria', 2, 'Sec. Bloque 4', 'Lengua Española', 'elisa'),
('6to. Secundaria', 3, 'Sec. Bloque 4', 'Matemática', 'gary'),
('6to. Secundaria', 4, 'Sec. Bloque 4', 'Ciencias Sociales', 'casandra'),
('6to. Secundaria', 5, 'Sec. Bloque 4', 'Matemática', 'gary'),
('6to. Secundaria', 1, 'Sec. Bloque 5', 'Ciencias Sociales', 'casandra'),
('6to. Secundaria', 2, 'Sec. Bloque 5', 'Educación Física', 'jsoriano'),
('6to. Secundaria', 3, 'Sec. Bloque 5', 'Lengua Española', 'elisa'),
('6to. Secundaria', 4, 'Sec. Bloque 5', 'Salida Optativa (Matemática aplicada a la tecnología)', 'gary'),
('6to. Secundaria', 5, 'Sec. Bloque 5', 'Formación Humana', 'ruth'),
('6to. Secundaria', 1, 'Sec. Bloque 6', 'Física', 'marcelis'),
('6to. Secundaria', 2, 'Sec. Bloque 6', 'Lengua Española', 'elisa'),
('6to. Secundaria', 3, 'Sec. Bloque 6', 'Física', 'marcelis'),
('6to. Secundaria', 4, 'Sec. Bloque 6', 'Formación Humana', 'ruth'),
('6to. Secundaria', 5, 'Sec. Bloque 6', 'Lengua Española', 'elisa');

do $$
declare esperadas int; resueltas int;
begin
  select count(*) into esperadas from _nuevo;
  select count(*) into resueltas
  from _nuevo n
  join class_periods p on p.school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and p.name = n.periodo
  join subjects sj on sj.school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and sj.name = n.materia
  join _doc d on d.key = n.doc;
  if esperadas <> resueltas then
    raise exception 'Solo % de % clases resuelven franja/materia/docente. Correr el diagnostico B.', resueltas, esperadas;
  end if;
end $$;

insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', n.grade, n.dia, p.id, sj.id, d.staff_id
from _nuevo n
join class_periods p on p.school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and p.name = n.periodo
join subjects sj on sj.school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and sj.name = n.materia
join _doc d on d.key = n.doc
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id = excluded.subject_id, staff_id = excluded.staff_id, updated_at = now();

-- Resumen: cuantas clases del horario nuevo quedaron, y cuantas del viejo sobran.
select (select count(*) from _nuevo) as clases_nuevas_cargadas,
       (select count(*) from class_schedules cs
         where cs.school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e'
           and exists (select 1 from class_periods pl where pl.id = cs.period_id and pl.level in ('primaria','secundaria'))
           and not exists (
             select 1 from _nuevo n
             join class_periods p on p.school_id = cs.school_id and p.name = n.periodo
             where n.grade = cs.grade_level and n.dia = cs.day_of_week and p.id = cs.period_id
           )) as clases_viejas_que_sobran;

commit;


-- =========================================================================
-- PARTE 2 -- INICIAL (transaccion aparte). Correr DESPUES de la parte 1.
-- Inglés de Nercy y de Yuleimi, y Ed. Fisica de Pre-kinder. Las franjas de Inicial
-- no son las de primaria (arrancan a las 8:00 y el recreo es de 9:05 a 9:45), asi que
-- se crean con level = 'inicial'. Los grados se buscan por su texto REAL en `students`:
-- si no hay EXACTAMENTE un texto distinto por grado, aborta.
-- OJO: Pre-kinder jueves tiene Ed. Fisica 9:10-10:00 e Ingles 9:45-10:30 (se pisan 15 min).
-- =========================================================================
begin;
insert into class_periods (school_id, name, start_time, end_time, sort_order, level)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Ini. 08:00', '08:00', '09:05', 21, 'inicial'
where not exists (select 1 from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ini. 08:00');
insert into class_periods (school_id, name, start_time, end_time, sort_order, level)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Ini. 09:10', '09:10', '10:00', 22, 'inicial'
where not exists (select 1 from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ini. 09:10');
insert into class_periods (school_id, name, start_time, end_time, sort_order, level)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Ini. 09:45', '09:45', '10:30', 23, 'inicial'
where not exists (select 1 from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ini. 09:45');
insert into class_periods (school_id, name, start_time, end_time, sort_order, level)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Ini. 10:30', '10:30', '11:10', 24, 'inicial'
where not exists (select 1 from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ini. 10:30');
insert into class_periods (school_id, name, start_time, end_time, sort_order, level)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', 'Ini. 11:10', '11:10', '11:50', 25, 'inicial'
where not exists (select 1 from class_periods where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and name='Ini. 11:10');

create temp table _doc_i (key text, staff_id uuid) on commit drop;
insert into _doc_i (key, staff_id)
select k.key, s.id
from (values
    ('jsoriano', 'jenn%', 'soriano%'),
    ('nercy', 'nercy%', '%')
) as k(key, f, l)
join staff s on s.school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and s.deleted_at is null
     and s.first_name ilike k.f and s.last_name ilike k.l;

create temp table _grado_i (cod text, texto text) on commit drop;
insert into _grado_i select 'pk', grade_level from students where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and deleted_at is null and enrollment_status='inscrito' and grade_level ~* '^pre[ -]*k.nder' group by grade_level;
insert into _grado_i select 'k', grade_level from students where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and deleted_at is null and enrollment_status='inscrito' and grade_level ~* '^k.nder' group by grade_level;
insert into _grado_i select 'pp', grade_level from students where school_id='0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and deleted_at is null and enrollment_status='inscrito' and grade_level ~* '^pre[ -]*primario' group by grade_level;

do $$
declare malos text;
begin
  select string_agg(cod || ' (' || n || ')', ', ') into malos from (
    select v.cod, count(g.texto) as n
    from (values ('pk'),('k'),('pp')) v(cod) left join _grado_i g on g.cod = v.cod
    group by v.cod having count(g.texto) <> 1) x;
  if malos is not null then
    raise exception 'Grados de Inicial sin texto unico en students (cod, textos distintos): %. Revisar el diagnostico C.', malos;
  end if;
  select string_agg(k, ', ') into malos from (values ('jsoriano'), ('nercy')) v(k)
   where (select count(*) from _doc_i where key = v.k) <> 1;
  if malos is not null then
    raise exception 'Docentes de Inicial sin ficha unica: %', malos;
  end if;
end $$;

create temp table _nuevo_i (cod text, dia int, periodo text, materia text, doc text) on commit drop;
insert into _nuevo_i values
('pk', 1, 'Ini. 08:00', 'Inglés', 'nercy'),
('pk', 4, 'Ini. 09:45', 'Inglés', 'nercy'),
('pk', 3, 'Ini. 10:30', 'Inglés', 'nercy'),
('k', 2, 'Ini. 08:00', 'Inglés', 'nercy'),
('k', 1, 'Ini. 09:45', 'Inglés', 'nercy'),
('k', 4, 'Ini. 10:30', 'Inglés', 'nercy'),
('k', 3, 'Ini. 11:10', 'Inglés', 'nercy'),
('k', 5, 'Ini. 11:10', 'Inglés', 'nercy'),
('pp', 4, 'Ini. 08:00', 'Inglés', 'nercy'),
('pp', 3, 'Ini. 09:45', 'Inglés', 'nercy'),
('pp', 2, 'Ini. 10:30', 'Inglés', 'nercy'),
('pp', 5, 'Ini. 10:30', 'Inglés', 'nercy'),
('pk', 3, 'Ini. 09:10', 'Educación Física', 'jsoriano'),
('pk', 4, 'Ini. 09:10', 'Educación Física', 'jsoriano');

insert into class_schedules (school_id, grade_level, day_of_week, period_id, subject_id, staff_id)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', g.texto, n.dia, p.id, sj.id, d.staff_id
from _nuevo_i n
join _grado_i g on g.cod = n.cod
join class_periods p on p.school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and p.name = n.periodo
join subjects sj on sj.school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and sj.name = n.materia
join _doc_i d on d.key = n.doc
on conflict (school_id, grade_level, day_of_week, period_id) do update
   set subject_id = excluded.subject_id, staff_id = excluded.staff_id, updated_at = now();

select (select count(*) from _nuevo_i) as clases_inicial_esperadas,
       (select count(*) from class_schedules cs join _grado_i g on g.texto = cs.grade_level
         where cs.school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e') as clases_inicial_en_base;
commit;

-- =========================================================================
-- PARTE 3 -- Adriana de los Santos Pena: ayudante docente de 1ro Primaria.
-- Solo la asignacion de grado (para que vea a sus estudiantes y ayude a pasar lista).
-- La ficha y el ACCESO se crean en Personal (puesto "Ayudante Docente", con su correo
-- real, y "Dar acceso al sistema"). Si la ficha aun no existe, esto no hace nada.
-- =========================================================================
insert into teacher_assignments (school_id, staff_id, grade_level, category)
select '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e', s.id, '1ro. Primaria', 'regular'
from staff s
where s.school_id = '0001da6e-2fe8-4dc9-97bf-8eadb7ee944e' and s.deleted_at is null
  and s.first_name ilike 'adriana%' and s.last_name ilike '%santos%'
  and not exists (select 1 from teacher_assignments t
                  where t.staff_id = s.id and t.category = 'regular' and t.grade_level = '1ro. Primaria');
