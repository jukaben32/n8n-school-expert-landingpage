-- =====================================================================
-- Conciliación Alegra -> MentorIApp : cobros del 1 al 8 de septiembre 2026
-- Centro Educativo Gran Manantial de Sabiduría
-- =====================================================================
-- Registra en Cuentas por Cobrar los cobros YA hechos por Alegra POS, para que
-- dejen de aparecer como deuda. Replica el botón "Registrar pago" de
-- /dashboard/tesoreria/cuentas-por-cobrar (Server Action recordExternalPayment).
--
-- REGLAS NO NEGOCIABLES:
--  1. NUNCA genera NCF (ncf/ncf_type quedan NULL). El e-CF real ya lo emitió
--     Alegra; un NCF local sería un documento fantasma ante la DGII.
--  2. NUNCA aplica mora. Sólo se registra lo que de verdad se cobró. Única
--     excepción: el e-CF E320000000410, que sí cobró RD$102.50 de mora.
--  3. Un e-CF conjunto a nombre del tutor se registra como VARIAS filas, una por
--     hermano, todas citando el mismo documento (requisito fiscal DGII).
--
-- EMPAREJAMIENTO: students.student_code (matrícula) está VACÍO en producción --
-- la matrícula sólo vive hoy en los contactos de Alegra. Por eso se empareja por
-- NOMBRE normalizado (sin acentos, sin puntuación, sin dobles espacios). La
-- columna "matricula" del diagnóstico queda como referencia para un backfill
-- futuro. Los e-CF a nombre del tutor se resuelven por cédula y, si está vacía,
-- por nombre del tutor.
--
-- CÓMO SE CORRE: PARTE 1 primero (SOLO LECTURA). Revisar. Luego PARTE 2.
-- Total esperado: 34 filas / RD$77,052.50 (76,950.00 mensualidad + 102.50 mora)
-- =====================================================================


-- =====================================================================
-- PARTE 1 — DIAGNÓSTICO (SOLO LECTURA — no modifica nada)
-- =====================================================================
-- Normalizador de nombres: minúsculas, sin acentos, sin puntuación, espacios colapsados.
-- Vive en pg_temp: desaparece al cerrar la sesión, NO deja nada en producción.
create or replace function pg_temp.nn(t text) returns text language sql immutable as $fn$
  select trim(regexp_replace(
           regexp_replace(
             lower(translate(coalesce(t,''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
             '[^a-z0-9 ]', ' ', 'g'),
           '\s+', ' ', 'g'))
$fn$;

with origen (ref, fecha, via, clave, nombre_alegra, pista, monto, metodo, cubre) as (values
  ($$E320000000381$$,$$2026-09-01$$,$$nombre$$,$$26-0041$$,$$SANEM MERCEDES FELICIANO$$,null,1950.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000383$$,$$2026-09-02$$,$$nombre$$,$$24-0033$$,$$Eliette Isaelis Rojas Navarro$$,null,1950.00,$$tarjeta$$,$$media cuota agosto$$),
  ($$E320000000384$$,$$2026-09-02$$,$$nombre$$,$$24-0083$$,$$Gianeder Isaac Mitchell Suero$$,null,1950.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000385$$,$$2026-09-02$$,$$nombre$$,$$23-0116$$,$$Nashly Gonzalez Olivarez$$,null,2050.00,$$tarjeta$$,$$media cuota agosto$$),
  ($$E320000000386$$,$$2026-09-02$$,$$nombre$$,$$23-0125$$,$$Camille Saint-Hilaire Morale$$,null,2050.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000387$$,$$2026-09-02$$,$$nombre$$,$$26-0019$$,$$HEATHER LIZ RONDON CASTILLO$$,null,1950.00,$$transferencia$$,$$media cuota agosto$$),
  ($$E320000000388$$,$$2026-09-02$$,$$nombre$$,$$26-0019$$,$$HEATHER LIZ RONDON CASTILLO$$,null,1950.00,$$transferencia$$,$$adelanto septiembre$$),
  ($$E320000000389$$,$$2026-09-03$$,$$nombre$$,$$14-0023$$,$$Dhanel Elian  Leonardo Mercedes$$,null,4500.00,$$transferencia$$,$$media cuota agosto + adelanto septiembre$$),
  ($$E320000000390$$,$$2026-09-03$$,$$nombre$$,$$23-0089$$,$$Matias Josue Peguero Diaz$$,null,1950.00,$$transferencia$$,$$media cuota agosto$$),
  ($$E310000000059$$,$$2026-09-03$$,$$ced$$,$$02301545162$$,$$Carlos Reyes$$,$$inicial$$,1950.00,$$transferencia$$,$$media cuota agosto$$),
  ($$E320000000391$$,$$2026-09-03$$,$$nombre$$,$$24-0041$$,$$Blayder Emmanuel Solis Castillo$$,null,2050.00,$$efectivo$$,$$adelanto octubre$$),
  ($$E320000000392$$,$$2026-09-03$$,$$nombre$$,$$23-0144$$,$$Johnley Jean Reyes$$,null,5850.00,$$tarjeta$$,$$media cuota agosto + adelanto septiembre$$),
  ($$E310000000060/1$$,$$2026-09-04$$,$$ced$$,$$02300785520$$,$$Osvaldo Nuñez Castro$$,$$Onaimi$$,2250.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E310000000060/2$$,$$2026-09-04$$,$$ced$$,$$02300785520$$,$$Osvaldo Nuñez Castro$$,$$Osvaldo$$,2250.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000394$$,$$2026-09-04$$,$$nombre$$,$$25-0006$$,$$Angel Jose Maria Santana$$,null,2250.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000395$$,$$2026-09-04$$,$$nombre$$,$$25-0007$$,$$Liany Esther Maria Santana$$,null,2250.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E310000000061$$,$$2026-09-04$$,$$ced$$,$$40223400348$$,$$Sabrina Silvestre$$,$$primaria$$,2050.00,$$transferencia$$,$$media cuota agosto$$),
  ($$E320000000396$$,$$2026-09-04$$,$$nombre$$,$$26-0028$$,$$Jhaydelin Hernandez Peralta$$,null,1950.00,$$transferencia$$,$$media cuota agosto$$),
  ($$E320000000397$$,$$2026-09-04$$,$$nombre$$,$$23-0117$$,$$Eythan Gadiel Angomas Pilier$$,null,2050.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000398$$,$$2026-09-04$$,$$nombre$$,$$25-0002$$,$$Diana Beltran Gonzalez$$,null,2250.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000399$$,$$2026-09-04$$,$$nombre$$,$$23-0108$$,$$Dyan Adriel Ramirez Mateo$$,null,1950.00,$$tarjeta$$,$$media cuota agosto$$),
  ($$E320000000400$$,$$2026-09-04$$,$$nombre$$,$$26-0045$$,$$Teylor Andrian Diaz Mota$$,null,2250.00,$$tarjeta$$,$$media cuota agosto$$),
  ($$E320000000401$$,$$2026-09-04$$,$$nombre$$,$$16-0059$$,$$Victor Emmanuel Sanchez Pilier$$,null,2250.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000402$$,$$2026-09-07$$,$$nombre$$,$$23-0007$$,$$Anfanie Elais Bracho Santana$$,null,2050.00,$$transferencia$$,$$media cuota agosto$$),
  ($$E320000000403$$,$$2026-09-07$$,$$nombre$$,$$23-0088$$,$$Carmen Grace Taveras de la Cruz$$,null,2050.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E310000000063$$,$$2026-09-07$$,$$ced$$,$$02301574204$$,$$Yomar Matos$$,$$secundaria$$,2250.00,$$tarjeta$$,$$media cuota agosto$$),
  ($$E310000000064$$,$$2026-09-07$$,$$ced$$,$$02301574204$$,$$Yomar Matos$$,$$primaria$$,2050.00,$$tarjeta$$,$$media cuota agosto$$),
  ($$E320000000404$$,$$2026-09-07$$,$$nombre$$,$$24-0057$$,$$Weiler Angeirel Guerrero Perez$$,null,2250.00,$$tarjeta$$,$$media cuota agosto$$),
  ($$E320000000405$$,$$2026-09-07$$,$$nombre$$,$$25-0012$$,$$Ismael Ezequiel Espinal Guilamo$$,null,1950.00,$$tarjeta$$,$$media cuota agosto$$),
  ($$E320000000406$$,$$2026-09-08$$,$$nombre$$,$$25-0026$$,$$Sara Abigail Calis Gonzalez$$,null,2050.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000407$$,$$2026-09-08$$,$$nombre$$,$$24-0040$$,$$Kelvin Jariel Benitez Solis$$,null,2050.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000408$$,$$2026-09-08$$,$$nombre$$,$$24-0039$$,$$Yariel Emilio Gil Solis$$,null,2050.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000409$$,$$2026-09-08$$,$$nombre$$,$$25-0020$$,$$Steven De Leon Beriguete$$,null,2250.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000410$$,$$2026-09-08$$,$$nombre$$,$$22-0025$$,$$Jayden Josias De los Santos Reynoso$$,null,2152.50,$$efectivo$$,$$media cuota agosto + mora RD$102.50 (SI se cobro)$$)
),
colegio as (select id from schools where name ilike '%Gran Manantial%' limit 1),
-- (a) por matricula, SOLO si algun dia se puebla students.student_code (hoy esta vacio)
m_codigo as (
  select o.ref, s.id sid, s.first_name||' '||s.last_name nom, 'matricula' via, 1 rango
  from origen o join students s
    on s.school_id=(select id from colegio) and s.deleted_at is null
   and lower(trim(coalesce(s.student_code,'@'))) = lower(trim(o.clave))
  where o.via='nombre'
),
-- (b) por nombre exacto normalizado  <-- el camino real hoy
m_nombre as (
  select o.ref, s.id sid, s.first_name||' '||s.last_name nom, 'nombre exacto' via, 2 rango
  from origen o join students s
    on s.school_id=(select id from colegio) and s.deleted_at is null
   and pg_temp.nn(s.first_name||' '||s.last_name) = pg_temp.nn(o.nombre_alegra)
  where o.via='nombre'
),
-- (c) aproximado: todas las palabras de Alegra aparecen en el nombre de la base
m_aprox as (
  select o.ref, s.id sid, s.first_name||' '||s.last_name nom, 'nombre aproximado' via, 3 rango
  from origen o join students s
    on s.school_id=(select id from colegio) and s.deleted_at is null
   and (select bool_and(tk = any(string_to_array(pg_temp.nn(s.first_name||' '||s.last_name),' ')))
        from unnest(string_to_array(pg_temp.nn(o.nombre_alegra),' ')) tk where tk<>'')
  where o.via='nombre'
),
-- (d) e-CF a nombre del tutor: por cedula, o por nombre del tutor si la cedula esta vacia
m_tutor as (
  select o.ref, s.id sid, s.first_name||' '||s.last_name nom, 'tutor+'||o.pista via, 2 rango
  from origen o
  join guardians g on g.school_id=(select id from colegio) and g.deleted_at is null
   and ( regexp_replace(coalesce(g.national_id,''),'[^0-9]','','g') = regexp_replace(o.clave,'[^0-9]','','g')
         and regexp_replace(coalesce(g.national_id,''),'[^0-9]','','g') <> ''
      or pg_temp.nn(g.first_name||' '||g.last_name) = pg_temp.nn(o.nombre_alegra) )
  join students s on s.family_id=g.family_id and s.deleted_at is null
  where o.via='ced'
    and ( o.pista in ('parvulo','inicial','primaria','secundaria')
            and school_level_for_grade(s.grade_level)=o.pista
          or o.pista not in ('parvulo','inicial','primaria','secundaria')
            and pg_temp.nn(s.first_name) like '%'||pg_temp.nn(o.pista)||'%' )
),
todas as (select * from m_codigo union select * from m_nombre union select * from m_aprox union select * from m_tutor),
mejor as (select ref, min(rango) r from todas group by ref),
emp as (select t.* from todas t join mejor m on m.ref=t.ref and m.r=t.rango),
agr as (
  select o.*, count(e.sid) cand, min(e.sid::text)::uuid sid, min(e.nom) nom, min(e.via) via_ok, min(e.rango) rango
  from origen o left join emp e on e.ref=o.ref
  group by o.ref,o.fecha,o.via,o.clave,o.nombre_alegra,o.pista,o.monto,o.metodo,o.cubre
)
select a.ref, a.fecha, a.monto, a.clave matricula, a.nombre_alegra,
  case when a.cand=1 and a.rango<=2 then 'OK'
       when a.cand=1 and a.rango=3  then '>>> APROXIMADO - confirmar a mano'
       when a.cand=0 then '>>> SIN EMPAREJAR'
       else '>>> AMBIGUO ('||a.cand||')' end estado,
  a.nom estudiante_en_bd, a.via_ok via,
  case when exists (select 1 from invoices i where i.school_id=(select id from colegio)
        and i.deleted_at is null and i.description like '%'||a.ref||'%')
       then '>>> YA CARGADO' else 'no' end ya_cargado,
  case when a.sid is not null and exists (select 1 from invoices i where i.student_id=a.sid
        and i.deleted_at is null and i.status='pagado' and i.total_amount=a.monto
        and i.due_date between date '2026-08-01' and date '2026-10-31'
        and i.description not like '%'||a.ref||'%')
       then '>>> OJO: YA HAY UN PAGO IGUAL' else 'no' end posible_duplicado
from agr a order by a.fecha, a.ref;

-- Control: pagos externos ya registrados (los 44 de RD$90,100 del 2026-09-07)
select count(*) pagos_ya_registrados, coalesce(sum(total_amount),0) monto
from invoices where school_id=(select id from schools where name ilike '%Gran Manantial%' limit 1)
  and deleted_at is null and status='pagado' and ncf is null;

-- Control: cuantos estudiantes tienen matricula cargada hoy (se espera 0)
select count(*) total, count(student_code) con_matricula from students
where school_id=(select id from schools where name ilike '%Gran Manantial%' limit 1) and deleted_at is null;


-- =====================================================================
-- PARTE 2 — CARGA (ESCRIBE. Sólo después de revisar la PARTE 1)
-- =====================================================================
-- Atómica. Carga sólo emparejamientos ÚNICOS y EXACTOS (nunca "aproximado"),
-- no cargados antes, y sin un pago igual ya existente.
-- Normalizador de nombres: minúsculas, sin acentos, sin puntuación, espacios colapsados.
-- Vive en pg_temp: desaparece al cerrar la sesión, NO deja nada en producción.
create or replace function pg_temp.nn(t text) returns text language sql immutable as $fn$
  select trim(regexp_replace(
           regexp_replace(
             lower(translate(coalesce(t,''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
             '[^a-z0-9 ]', ' ', 'g'),
           '\s+', ' ', 'g'))
$fn$;

begin;

-- Concepto "Mensualidad" (find-or-create, igual que recordExternalPayment)
insert into billing_concepts (school_id, name, amount, recurrence, applies_to)
select c.id,'Mensualidad',4100,'monthly','student'
from (select id from schools where name ilike '%Gran Manantial%' limit 1) c
where not exists (select 1 from billing_concepts b where b.school_id=c.id
  and b.recurrence='monthly' and b.name ilike '%mensualidad%' and b.deleted_at is null);

with origen (ref, fecha, via, clave, nombre_alegra, pista, monto, metodo, cubre) as (values
  ($$E320000000381$$,$$2026-09-01$$,$$nombre$$,$$26-0041$$,$$SANEM MERCEDES FELICIANO$$,null,1950.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000383$$,$$2026-09-02$$,$$nombre$$,$$24-0033$$,$$Eliette Isaelis Rojas Navarro$$,null,1950.00,$$tarjeta$$,$$media cuota agosto$$),
  ($$E320000000384$$,$$2026-09-02$$,$$nombre$$,$$24-0083$$,$$Gianeder Isaac Mitchell Suero$$,null,1950.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000385$$,$$2026-09-02$$,$$nombre$$,$$23-0116$$,$$Nashly Gonzalez Olivarez$$,null,2050.00,$$tarjeta$$,$$media cuota agosto$$),
  ($$E320000000386$$,$$2026-09-02$$,$$nombre$$,$$23-0125$$,$$Camille Saint-Hilaire Morale$$,null,2050.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000387$$,$$2026-09-02$$,$$nombre$$,$$26-0019$$,$$HEATHER LIZ RONDON CASTILLO$$,null,1950.00,$$transferencia$$,$$media cuota agosto$$),
  ($$E320000000388$$,$$2026-09-02$$,$$nombre$$,$$26-0019$$,$$HEATHER LIZ RONDON CASTILLO$$,null,1950.00,$$transferencia$$,$$adelanto septiembre$$),
  ($$E320000000389$$,$$2026-09-03$$,$$nombre$$,$$14-0023$$,$$Dhanel Elian  Leonardo Mercedes$$,null,4500.00,$$transferencia$$,$$media cuota agosto + adelanto septiembre$$),
  ($$E320000000390$$,$$2026-09-03$$,$$nombre$$,$$23-0089$$,$$Matias Josue Peguero Diaz$$,null,1950.00,$$transferencia$$,$$media cuota agosto$$),
  ($$E310000000059$$,$$2026-09-03$$,$$ced$$,$$02301545162$$,$$Carlos Reyes$$,$$inicial$$,1950.00,$$transferencia$$,$$media cuota agosto$$),
  ($$E320000000391$$,$$2026-09-03$$,$$nombre$$,$$24-0041$$,$$Blayder Emmanuel Solis Castillo$$,null,2050.00,$$efectivo$$,$$adelanto octubre$$),
  ($$E320000000392$$,$$2026-09-03$$,$$nombre$$,$$23-0144$$,$$Johnley Jean Reyes$$,null,5850.00,$$tarjeta$$,$$media cuota agosto + adelanto septiembre$$),
  ($$E310000000060/1$$,$$2026-09-04$$,$$ced$$,$$02300785520$$,$$Osvaldo Nuñez Castro$$,$$Onaimi$$,2250.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E310000000060/2$$,$$2026-09-04$$,$$ced$$,$$02300785520$$,$$Osvaldo Nuñez Castro$$,$$Osvaldo$$,2250.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000394$$,$$2026-09-04$$,$$nombre$$,$$25-0006$$,$$Angel Jose Maria Santana$$,null,2250.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000395$$,$$2026-09-04$$,$$nombre$$,$$25-0007$$,$$Liany Esther Maria Santana$$,null,2250.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E310000000061$$,$$2026-09-04$$,$$ced$$,$$40223400348$$,$$Sabrina Silvestre$$,$$primaria$$,2050.00,$$transferencia$$,$$media cuota agosto$$),
  ($$E320000000396$$,$$2026-09-04$$,$$nombre$$,$$26-0028$$,$$Jhaydelin Hernandez Peralta$$,null,1950.00,$$transferencia$$,$$media cuota agosto$$),
  ($$E320000000397$$,$$2026-09-04$$,$$nombre$$,$$23-0117$$,$$Eythan Gadiel Angomas Pilier$$,null,2050.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000398$$,$$2026-09-04$$,$$nombre$$,$$25-0002$$,$$Diana Beltran Gonzalez$$,null,2250.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000399$$,$$2026-09-04$$,$$nombre$$,$$23-0108$$,$$Dyan Adriel Ramirez Mateo$$,null,1950.00,$$tarjeta$$,$$media cuota agosto$$),
  ($$E320000000400$$,$$2026-09-04$$,$$nombre$$,$$26-0045$$,$$Teylor Andrian Diaz Mota$$,null,2250.00,$$tarjeta$$,$$media cuota agosto$$),
  ($$E320000000401$$,$$2026-09-04$$,$$nombre$$,$$16-0059$$,$$Victor Emmanuel Sanchez Pilier$$,null,2250.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000402$$,$$2026-09-07$$,$$nombre$$,$$23-0007$$,$$Anfanie Elais Bracho Santana$$,null,2050.00,$$transferencia$$,$$media cuota agosto$$),
  ($$E320000000403$$,$$2026-09-07$$,$$nombre$$,$$23-0088$$,$$Carmen Grace Taveras de la Cruz$$,null,2050.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E310000000063$$,$$2026-09-07$$,$$ced$$,$$02301574204$$,$$Yomar Matos$$,$$secundaria$$,2250.00,$$tarjeta$$,$$media cuota agosto$$),
  ($$E310000000064$$,$$2026-09-07$$,$$ced$$,$$02301574204$$,$$Yomar Matos$$,$$primaria$$,2050.00,$$tarjeta$$,$$media cuota agosto$$),
  ($$E320000000404$$,$$2026-09-07$$,$$nombre$$,$$24-0057$$,$$Weiler Angeirel Guerrero Perez$$,null,2250.00,$$tarjeta$$,$$media cuota agosto$$),
  ($$E320000000405$$,$$2026-09-07$$,$$nombre$$,$$25-0012$$,$$Ismael Ezequiel Espinal Guilamo$$,null,1950.00,$$tarjeta$$,$$media cuota agosto$$),
  ($$E320000000406$$,$$2026-09-08$$,$$nombre$$,$$25-0026$$,$$Sara Abigail Calis Gonzalez$$,null,2050.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000407$$,$$2026-09-08$$,$$nombre$$,$$24-0040$$,$$Kelvin Jariel Benitez Solis$$,null,2050.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000408$$,$$2026-09-08$$,$$nombre$$,$$24-0039$$,$$Yariel Emilio Gil Solis$$,null,2050.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000409$$,$$2026-09-08$$,$$nombre$$,$$25-0020$$,$$Steven De Leon Beriguete$$,null,2250.00,$$efectivo$$,$$media cuota agosto$$),
  ($$E320000000410$$,$$2026-09-08$$,$$nombre$$,$$22-0025$$,$$Jayden Josias De los Santos Reynoso$$,null,2152.50,$$efectivo$$,$$media cuota agosto + mora RD$102.50 (SI se cobro)$$)
),
colegio as (select id from schools where name ilike '%Gran Manantial%' limit 1),
-- (a) por matricula, SOLO si algun dia se puebla students.student_code (hoy esta vacio)
m_codigo as (
  select o.ref, s.id sid, s.first_name||' '||s.last_name nom, 'matricula' via, 1 rango
  from origen o join students s
    on s.school_id=(select id from colegio) and s.deleted_at is null
   and lower(trim(coalesce(s.student_code,'@'))) = lower(trim(o.clave))
  where o.via='nombre'
),
-- (b) por nombre exacto normalizado  <-- el camino real hoy
m_nombre as (
  select o.ref, s.id sid, s.first_name||' '||s.last_name nom, 'nombre exacto' via, 2 rango
  from origen o join students s
    on s.school_id=(select id from colegio) and s.deleted_at is null
   and pg_temp.nn(s.first_name||' '||s.last_name) = pg_temp.nn(o.nombre_alegra)
  where o.via='nombre'
),
-- (c) aproximado: todas las palabras de Alegra aparecen en el nombre de la base
m_aprox as (
  select o.ref, s.id sid, s.first_name||' '||s.last_name nom, 'nombre aproximado' via, 3 rango
  from origen o join students s
    on s.school_id=(select id from colegio) and s.deleted_at is null
   and (select bool_and(tk = any(string_to_array(pg_temp.nn(s.first_name||' '||s.last_name),' ')))
        from unnest(string_to_array(pg_temp.nn(o.nombre_alegra),' ')) tk where tk<>'')
  where o.via='nombre'
),
-- (d) e-CF a nombre del tutor: por cedula, o por nombre del tutor si la cedula esta vacia
m_tutor as (
  select o.ref, s.id sid, s.first_name||' '||s.last_name nom, 'tutor+'||o.pista via, 2 rango
  from origen o
  join guardians g on g.school_id=(select id from colegio) and g.deleted_at is null
   and ( regexp_replace(coalesce(g.national_id,''),'[^0-9]','','g') = regexp_replace(o.clave,'[^0-9]','','g')
         and regexp_replace(coalesce(g.national_id,''),'[^0-9]','','g') <> ''
      or pg_temp.nn(g.first_name||' '||g.last_name) = pg_temp.nn(o.nombre_alegra) )
  join students s on s.family_id=g.family_id and s.deleted_at is null
  where o.via='ced'
    and ( o.pista in ('parvulo','inicial','primaria','secundaria')
            and school_level_for_grade(s.grade_level)=o.pista
          or o.pista not in ('parvulo','inicial','primaria','secundaria')
            and pg_temp.nn(s.first_name) like '%'||pg_temp.nn(o.pista)||'%' )
),
todas as (select * from m_codigo union select * from m_nombre union select * from m_aprox union select * from m_tutor),
mejor as (select ref, min(rango) r from todas group by ref),
emp as (select t.* from todas t join mejor m on m.ref=t.ref and m.r=t.rango),
agr as (
  select o.*, count(e.sid) cand, min(e.sid::text)::uuid sid, min(e.nom) nom, min(e.via) via_ok, min(e.rango) rango
  from origen o left join emp e on e.ref=o.ref
  group by o.ref,o.fecha,o.via,o.clave,o.nombre_alegra,o.pista,o.monto,o.metodo,o.cubre
),
elegibles as (
  select a.*, 'Mensualidad — cobro ya registrado (Alegra (POS)): e-CF '||a.ref||' · '||a.metodo||' · '||a.cubre desc_,
              'e-CF '||a.ref||' · '||a.metodo||' · '||a.cubre nota
  from agr a
  where a.cand=1 and a.rango<=2          -- NUNCA carga un match aproximado ni ambiguo
    and not exists (select 1 from invoices i where i.school_id=(select id from colegio)
          and i.deleted_at is null and i.description like '%'||a.ref||'%')
    and not exists (select 1 from invoices i where i.student_id=a.sid
          and i.deleted_at is null and i.status='pagado' and i.total_amount=a.monto
          and i.due_date between date '2026-08-01' and date '2026-10-31'
          and i.description not like '%'||a.ref||'%')
),
actor as (select id from users_profiles where school_id=(select id from colegio)
          and role in ('director','school_admin') order by role limit 1),
concepto as (select id from billing_concepts where school_id=(select id from colegio)
             and recurrence='monthly' and name ilike '%mensualidad%' and deleted_at is null limit 1),
nuevas as (
  insert into invoices (school_id,family_id,student_id,concept_id,description,amount,tax_amount,
                        total_amount,due_date,status,paid_at,ncf,ncf_type,created_by)
  select (select id from colegio), s.family_id, e.sid, (select id from concepto), e.desc_,
         e.monto, 0, e.monto, e.fecha::date, 'pagado', (e.fecha||' 00:00:00')::timestamptz,
         null, null,                                  -- <<< NUNCA se genera NCF
         (select id from actor)
  from elegibles e join students s on s.id=e.sid
  returning id, description, total_amount, paid_at
)
insert into payments (school_id,invoice_id,amount_paid,payment_method,received_by,paid_at,notes)
select (select id from colegio), n.id, n.total_amount, 'alegra', (select id from actor), n.paid_at, e.nota
from nuevas n join elegibles e on n.description like '%'||e.ref||'%';

select 'cargado por este script' concepto, count(*) filas, coalesce(sum(total_amount),0) monto
from invoices where school_id=(select id from schools where name ilike '%Gran Manantial%' limit 1)
  and deleted_at is null and description like '%e-CF E3%'
union all
select 'control: con NCF (debe ser 0)', count(*), 0 from invoices
where description like '%e-CF E3%' and ncf is not null;

commit;

-- =====================================================================
-- REVERSIÓN (borra SOLO lo que cargó este script)
-- =====================================================================
-- begin;
--   delete from payments where invoice_id in (select id from invoices
--     where school_id=(select id from schools where name ilike '%Gran Manantial%' limit 1)
--       and description like '%e-CF E3%');
--   delete from invoices where school_id=(select id from schools where name ilike '%Gran Manantial%' limit 1)
--     and description like '%e-CF E3%';
-- commit;
