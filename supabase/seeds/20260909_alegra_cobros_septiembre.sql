-- =====================================================================
-- Conciliación Alegra -> MentorIApp : cobros del 1 al 8 de septiembre 2026
-- =====================================================================
-- Centro Educativo Gran Manantial de Sabiduría.
--
-- QUÉ HACE: registra en Cuentas por Cobrar los cobros que YA se hicieron por
-- Alegra POS, para que dejen de aparecer como deuda. Replica exactamente lo
-- que hace el botón "Registrar pago" de /dashboard/tesoreria/cuentas-por-cobrar
-- (Server Action recordExternalPayment).
--
-- REGLAS NO NEGOCIABLES QUE RESPETA:
--   1. NUNCA genera NCF. ncf y ncf_type quedan en NULL. El comprobante fiscal
--      real (e-CF) ya lo emitió Alegra; un NCF local sería un documento
--      fantasma ante la DGII.
--   2. NUNCA aplica mora. Se registra sólo lo que de verdad se cobró. El
--      recargo de esa pantalla es calculado, no una factura: al quedar la
--      cuota saldada desaparece solo. La ÚNICA excepción es el e-CF
--      E320000000410, que sí cobró RD$102.50 de mora de verdad.
--   3. Un e-CF conjunto a nombre del tutor (varios hermanos) se registra como
--      VARIAS filas, una por estudiante, todas citando el mismo documento.
--      Ver E310000000060 (Onaimi y Osvaldo).
--
-- CÓMO SE CORRE:
--   PARTE 1 primero (SOLO LECTURA, no escribe nada). Revisar su salida.
--   PARTE 2 después, sólo si la PARTE 1 se ve bien.
--
-- Total esperado: 34 filas / RD$77,052.50 (76,950.00 mensualidad + 102.50 mora)
-- =====================================================================


-- =====================================================================
-- PARTE 1 — DIAGNÓSTICO (SOLO LECTURA — no modifica nada)
-- =====================================================================
with origen (ref, fecha, match_by, clave, nombre_alegra, pista, monto, metodo, cubre) as (values
  ('E320000000381','2026-09-01','code','26-0041','SANEM MERCEDES FELICIANO'            ,null        ,1950.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000383','2026-09-02','code','24-0033','Eliette Isaelis Rojas Navarro'       ,null        ,1950.00,'tarjeta'      ,'media cuota agosto'),
  ('E320000000384','2026-09-02','code','24-0083','Gianeder Isaac Mitchell Suero'       ,null        ,1950.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000385','2026-09-02','code','23-0116','Nashly Gonzalez Olivarez'            ,null        ,2050.00,'tarjeta'      ,'media cuota agosto'),
  ('E320000000386','2026-09-02','code','23-0125','Camille Saint-Hilaire Morale'        ,null        ,2050.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000387','2026-09-02','code','26-0019','HEATHER LIZ RONDON CASTILLO'         ,null        ,1950.00,'transferencia','media cuota agosto'),
  ('E320000000388','2026-09-02','code','26-0019','HEATHER LIZ RONDON CASTILLO'         ,null        ,1950.00,'transferencia','adelanto septiembre'),
  ('E320000000389','2026-09-03','code','14-0023','Dhanel Elian Leonardo Mercedes'      ,null        ,4500.00,'transferencia','media cuota agosto + adelanto septiembre'),
  ('E320000000390','2026-09-03','code','23-0089','Matias Josue Peguero Diaz'           ,null        ,1950.00,'transferencia','media cuota agosto'),
  ('E310000000059','2026-09-03','ced' ,'02301545162','Carlos Reyes (tutor)'            ,'inicial'   ,1950.00,'transferencia','media cuota agosto'),
  ('E320000000391','2026-09-03','code','24-0041','Blayder Emmanuel Solis Castillo'     ,null        ,2050.00,'efectivo'     ,'adelanto octubre'),
  ('E320000000392','2026-09-03','code','23-0144','Johnley Jean Reyes'                  ,null        ,5850.00,'tarjeta'      ,'media cuota agosto + adelanto septiembre'),
  ('E310000000060/1','2026-09-04','ced','02300785520','Osvaldo Nunez Castro (tutor)'   ,'Onaimi'    ,2250.00,'efectivo'     ,'media cuota agosto'),
  ('E310000000060/2','2026-09-04','ced','02300785520','Osvaldo Nunez Castro (tutor)'   ,'Osvaldo'   ,2250.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000394','2026-09-04','code','25-0006','Angel Jose Maria Santana'            ,null        ,2250.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000395','2026-09-04','code','25-0007','Liany Esther Maria Santana'          ,null        ,2250.00,'efectivo'     ,'media cuota agosto'),
  ('E310000000061','2026-09-04','ced' ,'40223400348','Sabrina Silvestre (tutor)'       ,'primaria'  ,2050.00,'transferencia','media cuota agosto'),
  ('E320000000396','2026-09-04','code','26-0028','Jhaydelin Hernandez Peralta'         ,null        ,1950.00,'transferencia','media cuota agosto'),
  ('E320000000397','2026-09-04','code','23-0117','Eythan Gadiel Angomas Pilier'        ,null        ,2050.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000398','2026-09-04','code','25-0002','Diana Beltran Gonzalez'              ,null        ,2250.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000399','2026-09-04','code','23-0108','Dyan Adriel Ramirez Mateo'           ,null        ,1950.00,'tarjeta'      ,'media cuota agosto'),
  ('E320000000400','2026-09-04','code','26-0045','Teylor Andrian Diaz Mota'            ,null        ,2250.00,'tarjeta'      ,'media cuota agosto'),
  ('E320000000401','2026-09-04','code','16-0059','Victor Emmanuel Sanchez Pilier'      ,null        ,2250.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000402','2026-09-07','code','23-0007','Anfanie Elais Bracho Santana'        ,null        ,2050.00,'transferencia','media cuota agosto'),
  ('E320000000403','2026-09-07','code','23-0088','Carmen Grace Taveras de la Cruz'     ,null        ,2050.00,'efectivo'     ,'media cuota agosto'),
  ('E310000000063','2026-09-07','ced' ,'02301574204','Yomar Matos (tutor)'             ,'secundaria',2250.00,'tarjeta'      ,'media cuota agosto'),
  ('E310000000064','2026-09-07','ced' ,'02301574204','Yomar Matos (tutor)'             ,'primaria'  ,2050.00,'tarjeta'      ,'media cuota agosto'),
  ('E320000000404','2026-09-07','code','24-0057','Weiler Angeirel Guerrero Perez'      ,null        ,2250.00,'tarjeta'      ,'media cuota agosto'),
  ('E320000000405','2026-09-07','code','25-0012','Ismael Ezequiel Espinal Guilamo'     ,null        ,1950.00,'tarjeta'      ,'media cuota agosto'),
  ('E320000000406','2026-09-08','code','25-0026','Sara Abigail Calis Gonzalez'         ,null        ,2050.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000407','2026-09-08','code','24-0040','Kelvin Jariel Benitez Solis'         ,null        ,2050.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000408','2026-09-08','code','24-0039','Yariel Emilio Gil Solis'             ,null        ,2050.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000409','2026-09-08','code','25-0020','Steven De Leon Beriguete'            ,null        ,2250.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000410','2026-09-08','code','22-0025','Jayden Josias De los Santos Reynoso' ,null        ,2152.50,'efectivo'     ,'media cuota agosto + mora RD$102.50 (SI se cobro)')
),
colegio as (
  select id from schools where name ilike '%Gran Manantial%' limit 1
),
-- Emparejamiento por matrícula (students.student_code)
por_codigo as (
  select o.ref, s.id as student_id, s.first_name||' '||s.last_name as nombre_bd, 'student_code' as via
  from origen o
  join students s
    on s.school_id = (select id from colegio)
   and s.deleted_at is null
   and lower(trim(s.student_code)) = lower(trim(o.clave))
  where o.match_by = 'code'
),
-- Emparejamiento por cédula del tutor (guardians.national_id) -> familia -> hijo
por_cedula as (
  select o.ref, s.id as student_id, s.first_name||' '||s.last_name as nombre_bd, 'cedula_tutor' as via
  from origen o
  join guardians g
    on g.school_id = (select id from colegio)
   and g.deleted_at is null
   and regexp_replace(coalesce(g.national_id,''), '[^0-9]', '', 'g') = regexp_replace(o.clave, '[^0-9]', '', 'g')
   and regexp_replace(coalesce(g.national_id,''), '[^0-9]', '', 'g') <> ''
  join students s
    on s.family_id = g.family_id
   and s.deleted_at is null
  where o.match_by = 'ced'
    and (
      -- desambiguación entre hermanos: por nombre de pila, o por nivel
      (o.pista in ('parvulo','inicial','primaria','secundaria')
        and school_level_for_grade(s.grade_level) = o.pista)
      or (o.pista not in ('parvulo','inicial','primaria','secundaria')
        and lower(translate(s.first_name,'áéíóúÁÉÍÓÚñÑ','aeiouAEIOUnN'))
             like '%'||lower(translate(o.pista,'áéíóúÁÉÍÓÚñÑ','aeiouAEIOUnN'))||'%')
    )
),
emparejado as (
  select * from por_codigo union all select * from por_cedula
),
agrupado as (
  select o.*, count(e.student_id) as candidatos,
         min(e.student_id::text)::uuid as student_id,
         min(e.nombre_bd) as nombre_bd, min(e.via) as via
  from origen o left join emparejado e on e.ref = o.ref
  group by o.ref,o.fecha,o.match_by,o.clave,o.nombre_alegra,o.pista,o.monto,o.metodo,o.cubre
)
select
  a.ref, a.fecha, a.monto, a.nombre_alegra,
  case when a.candidatos = 1 then 'OK'
       when a.candidatos = 0 then '>>> SIN EMPAREJAR'
       else '>>> AMBIGUO ('||a.candidatos||' candidatos)' end as emparejamiento,
  a.nombre_bd as estudiante_en_bd, a.via,
  case when exists (
         select 1 from invoices i
         where i.school_id = (select id from colegio)
           and i.deleted_at is null
           and i.description like '%'||a.ref||'%'
       ) then '>>> YA CARGADO POR ESTE SCRIPT' else 'no' end as ya_cargado,
  case when a.student_id is not null and exists (
         select 1 from invoices i
         where i.student_id = a.student_id
           and i.deleted_at is null
           and i.status = 'pagado'
           and i.total_amount = a.monto
           and i.due_date between date '2026-08-01' and date '2026-10-31'
           and i.description not like '%'||a.ref||'%'
       ) then '>>> OJO: YA HAY UN PAGO IGUAL (revisar antes de cargar)' else 'no' end as posible_duplicado
from agrupado a
order by a.fecha, a.ref;

-- Control: cuántos pagos externos ya existen (los 44 de RD$90,100 del 2026-09-07)
select count(*) as pagos_ya_registrados, coalesce(sum(total_amount),0) as monto
from invoices
where school_id = (select id from schools where name ilike '%Gran Manantial%' limit 1)
  and deleted_at is null and status = 'pagado' and ncf is null;



-- =====================================================================
-- PARTE 2 — CARGA  (ESCRIBE. Correr sólo después de revisar la PARTE 1)
-- =====================================================================
-- Atómica: o entra todo o no entra nada.
-- Sólo carga las filas con emparejamiento único, no cargadas antes por este
-- script, y sin un pago igual ya existente. Lo que salte se lista al final.

begin;

-- 2.1 Concepto "Mensualidad" (find-or-create, igual que recordExternalPayment)
insert into billing_concepts (school_id, name, amount, recurrence, applies_to)
select c.id, 'Mensualidad', 4100, 'monthly', 'student'
from (select id from schools where name ilike '%Gran Manantial%' limit 1) c
where not exists (
  select 1 from billing_concepts b
  where b.school_id = c.id and b.recurrence = 'monthly'
    and b.name ilike '%mensualidad%' and b.deleted_at is null);

-- 2.2 Facturas (status pagado, SIN NCF) + su pago
with origen (ref, fecha, match_by, clave, nombre_alegra, pista, monto, metodo, cubre) as (values
  ('E320000000381','2026-09-01','code','26-0041','SANEM MERCEDES FELICIANO'            ,null        ,1950.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000383','2026-09-02','code','24-0033','Eliette Isaelis Rojas Navarro'       ,null        ,1950.00,'tarjeta'      ,'media cuota agosto'),
  ('E320000000384','2026-09-02','code','24-0083','Gianeder Isaac Mitchell Suero'       ,null        ,1950.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000385','2026-09-02','code','23-0116','Nashly Gonzalez Olivarez'            ,null        ,2050.00,'tarjeta'      ,'media cuota agosto'),
  ('E320000000386','2026-09-02','code','23-0125','Camille Saint-Hilaire Morale'        ,null        ,2050.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000387','2026-09-02','code','26-0019','HEATHER LIZ RONDON CASTILLO'         ,null        ,1950.00,'transferencia','media cuota agosto'),
  ('E320000000388','2026-09-02','code','26-0019','HEATHER LIZ RONDON CASTILLO'         ,null        ,1950.00,'transferencia','adelanto septiembre'),
  ('E320000000389','2026-09-03','code','14-0023','Dhanel Elian Leonardo Mercedes'      ,null        ,4500.00,'transferencia','media cuota agosto + adelanto septiembre'),
  ('E320000000390','2026-09-03','code','23-0089','Matias Josue Peguero Diaz'           ,null        ,1950.00,'transferencia','media cuota agosto'),
  ('E310000000059','2026-09-03','ced' ,'02301545162','Carlos Reyes (tutor)'            ,'inicial'   ,1950.00,'transferencia','media cuota agosto'),
  ('E320000000391','2026-09-03','code','24-0041','Blayder Emmanuel Solis Castillo'     ,null        ,2050.00,'efectivo'     ,'adelanto octubre'),
  ('E320000000392','2026-09-03','code','23-0144','Johnley Jean Reyes'                  ,null        ,5850.00,'tarjeta'      ,'media cuota agosto + adelanto septiembre'),
  ('E310000000060/1','2026-09-04','ced','02300785520','Osvaldo Nunez Castro (tutor)'   ,'Onaimi'    ,2250.00,'efectivo'     ,'media cuota agosto'),
  ('E310000000060/2','2026-09-04','ced','02300785520','Osvaldo Nunez Castro (tutor)'   ,'Osvaldo'   ,2250.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000394','2026-09-04','code','25-0006','Angel Jose Maria Santana'            ,null        ,2250.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000395','2026-09-04','code','25-0007','Liany Esther Maria Santana'          ,null        ,2250.00,'efectivo'     ,'media cuota agosto'),
  ('E310000000061','2026-09-04','ced' ,'40223400348','Sabrina Silvestre (tutor)'       ,'primaria'  ,2050.00,'transferencia','media cuota agosto'),
  ('E320000000396','2026-09-04','code','26-0028','Jhaydelin Hernandez Peralta'         ,null        ,1950.00,'transferencia','media cuota agosto'),
  ('E320000000397','2026-09-04','code','23-0117','Eythan Gadiel Angomas Pilier'        ,null        ,2050.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000398','2026-09-04','code','25-0002','Diana Beltran Gonzalez'              ,null        ,2250.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000399','2026-09-04','code','23-0108','Dyan Adriel Ramirez Mateo'           ,null        ,1950.00,'tarjeta'      ,'media cuota agosto'),
  ('E320000000400','2026-09-04','code','26-0045','Teylor Andrian Diaz Mota'            ,null        ,2250.00,'tarjeta'      ,'media cuota agosto'),
  ('E320000000401','2026-09-04','code','16-0059','Victor Emmanuel Sanchez Pilier'      ,null        ,2250.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000402','2026-09-07','code','23-0007','Anfanie Elais Bracho Santana'        ,null        ,2050.00,'transferencia','media cuota agosto'),
  ('E320000000403','2026-09-07','code','23-0088','Carmen Grace Taveras de la Cruz'     ,null        ,2050.00,'efectivo'     ,'media cuota agosto'),
  ('E310000000063','2026-09-07','ced' ,'02301574204','Yomar Matos (tutor)'             ,'secundaria',2250.00,'tarjeta'      ,'media cuota agosto'),
  ('E310000000064','2026-09-07','ced' ,'02301574204','Yomar Matos (tutor)'             ,'primaria'  ,2050.00,'tarjeta'      ,'media cuota agosto'),
  ('E320000000404','2026-09-07','code','24-0057','Weiler Angeirel Guerrero Perez'      ,null        ,2250.00,'tarjeta'      ,'media cuota agosto'),
  ('E320000000405','2026-09-07','code','25-0012','Ismael Ezequiel Espinal Guilamo'     ,null        ,1950.00,'tarjeta'      ,'media cuota agosto'),
  ('E320000000406','2026-09-08','code','25-0026','Sara Abigail Calis Gonzalez'         ,null        ,2050.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000407','2026-09-08','code','24-0040','Kelvin Jariel Benitez Solis'         ,null        ,2050.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000408','2026-09-08','code','24-0039','Yariel Emilio Gil Solis'             ,null        ,2050.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000409','2026-09-08','code','25-0020','Steven De Leon Beriguete'            ,null        ,2250.00,'efectivo'     ,'media cuota agosto'),
  ('E320000000410','2026-09-08','code','22-0025','Jayden Josias De los Santos Reynoso' ,null        ,2152.50,'efectivo'     ,'media cuota agosto + mora RD$102.50 (SI se cobro)')
),
colegio as (
  select id from schools where name ilike '%Gran Manantial%' limit 1
),
-- Emparejamiento por matrícula (students.student_code)
por_codigo as (
  select o.ref, s.id as student_id, s.first_name||' '||s.last_name as nombre_bd, 'student_code' as via
  from origen o
  join students s
    on s.school_id = (select id from colegio)
   and s.deleted_at is null
   and lower(trim(s.student_code)) = lower(trim(o.clave))
  where o.match_by = 'code'
),
-- Emparejamiento por cédula del tutor (guardians.national_id) -> familia -> hijo
por_cedula as (
  select o.ref, s.id as student_id, s.first_name||' '||s.last_name as nombre_bd, 'cedula_tutor' as via
  from origen o
  join guardians g
    on g.school_id = (select id from colegio)
   and g.deleted_at is null
   and regexp_replace(coalesce(g.national_id,''), '[^0-9]', '', 'g') = regexp_replace(o.clave, '[^0-9]', '', 'g')
   and regexp_replace(coalesce(g.national_id,''), '[^0-9]', '', 'g') <> ''
  join students s
    on s.family_id = g.family_id
   and s.deleted_at is null
  where o.match_by = 'ced'
    and (
      -- desambiguación entre hermanos: por nombre de pila, o por nivel
      (o.pista in ('parvulo','inicial','primaria','secundaria')
        and school_level_for_grade(s.grade_level) = o.pista)
      or (o.pista not in ('parvulo','inicial','primaria','secundaria')
        and lower(translate(s.first_name,'áéíóúÁÉÍÓÚñÑ','aeiouAEIOUnN'))
             like '%'||lower(translate(o.pista,'áéíóúÁÉÍÓÚñÑ','aeiouAEIOUnN'))||'%')
    )
),
emparejado as (
  select * from por_codigo union all select * from por_cedula
),
agrupado as (
  select o.*, count(e.student_id) as candidatos,
         min(e.student_id::text)::uuid as student_id,
         min(e.nombre_bd) as nombre_bd, min(e.via) as via
  from origen o left join emparejado e on e.ref = o.ref
  group by o.ref,o.fecha,o.match_by,o.clave,o.nombre_alegra,o.pista,o.monto,o.metodo,o.cubre
),
elegibles as (
  select a.*,
         'Mensualidad — cobro ya registrado (Alegra (POS)): e-CF '||a.ref||
           ' · '||a.metodo||' · '||a.cubre as descripcion,
         'e-CF '||a.ref||' · '||a.metodo||' · '||a.cubre as nota
  from agrupado a
  where a.candidatos = 1
    and not exists (select 1 from invoices i
                    where i.school_id = (select id from colegio)
                      and i.deleted_at is null
                      and i.description like '%'||a.ref||'%')
    and not exists (select 1 from invoices i
                    where i.student_id = a.student_id
                      and i.deleted_at is null and i.status = 'pagado'
                      and i.total_amount = a.monto
                      and i.due_date between date '2026-08-01' and date '2026-10-31'
                      and i.description not like '%'||a.ref||'%')
),
actor as (
  select id from users_profiles
  where school_id = (select id from colegio) and role in ('director','school_admin')
  order by role limit 1
),
concepto as (
  select id from billing_concepts
  where school_id = (select id from colegio) and recurrence = 'monthly'
    and name ilike '%mensualidad%' and deleted_at is null
  limit 1
),
nuevas as (
  insert into invoices (school_id, family_id, student_id, concept_id, description,
                        amount, tax_amount, total_amount, due_date, status, paid_at,
                        ncf, ncf_type, created_by)
  select (select id from colegio), s.family_id, e.student_id, (select id from concepto),
         e.descripcion, e.monto, 0, e.monto, e.fecha::date, 'pagado',
         (e.fecha||' 00:00:00')::timestamptz,
         null, null,                      -- <<< NUNCA se genera NCF
         (select id from actor)
  from elegibles e join students s on s.id = e.student_id
  returning id, description, total_amount, paid_at
)
insert into payments (school_id, invoice_id, amount_paid, payment_method, received_by, paid_at, notes)
select (select id from colegio), n.id, n.total_amount, 'alegra', (select id from actor),
       n.paid_at, e.nota
from nuevas n join elegibles e on n.description like '%'||e.ref||'%';

-- 2.3 Verificación dentro de la transacción
select 'cargado por este script' as concepto,
       count(*) as filas, coalesce(sum(total_amount),0) as monto
from invoices
where school_id = (select id from schools where name ilike '%Gran Manantial%' limit 1)
  and deleted_at is null and description like '%e-CF E3%'
union all
select 'control: ninguna con NCF (debe ser 0)', count(*), 0
from invoices
where description like '%e-CF E3%' and ncf is not null;

commit;

-- =====================================================================
-- REVERSIÓN (si algo salió mal). Borra SOLO lo que cargó este script.
-- =====================================================================
-- begin;
--   delete from payments where invoice_id in (
--     select id from invoices
--     where school_id = (select id from schools where name ilike '%Gran Manantial%' limit 1)
--       and description like '%e-CF E3%');
--   delete from invoices
--   where school_id = (select id from schools where name ilike '%Gran Manantial%' limit 1)
--     and description like '%e-CF E3%';
-- commit;
