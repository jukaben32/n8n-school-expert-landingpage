-- Prueba de la migración 20261015000000_payslips.sql contra un Postgres LOCAL
-- con un esquema espejo mínimo (no toca producción).
--
-- Uso (desde la raíz del repo, en una base vacía):
--   psql -v ON_ERROR_STOP=1 -f scripts/test-payslips.sql
--
-- Simula la sesión igual que PostgREST: set local role authenticated +
-- request.jwt.claim.sub. Cada comprobación falla con RAISE EXCEPTION.

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $$;

create table schools (id uuid primary key default gen_random_uuid(), name text);
create table staff (id uuid primary key default gen_random_uuid(), school_id uuid references schools(id), full_name text);
create table users_profiles (
  id uuid primary key default gen_random_uuid(), auth_id uuid unique, school_id uuid references schools(id),
  role text, staff_id uuid references staff(id), guardian_id uuid);
create or replace function is_super_admin() returns boolean language sql stable security definer as
$$ select exists (select 1 from users_profiles where auth_id = auth.uid() and role = 'super_admin') $$;
grant usage on schema public, auth to authenticated;
grant select on schools, staff, users_profiles to authenticated;
grant execute on function auth.uid(), is_super_admin() to authenticated;
alter table users_profiles enable row level security;
create policy own_read on users_profiles for select using (auth_id = auth.uid());

-- Datos
insert into schools (id, name) values ('00000000-0000-0000-0000-0000000000a1','A'),('00000000-0000-0000-0000-0000000000b1','B');
insert into staff (id, school_id, full_name) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','Docente 1'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','Docente 2'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000a1','Secretaria'),
 ('10000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-0000000000a1','Directora');
insert into users_profiles (id, auth_id, school_id, role, staff_id) values
 ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','teacher','10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','teacher','10000000-0000-0000-0000-000000000002'),
 ('20000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000a1','reception','10000000-0000-0000-0000-000000000003'),
 ('20000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000a1','guardian',null),
 ('20000000-0000-0000-0000-000000000005','30000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000a1','student',null),
 ('20000000-0000-0000-0000-000000000006','30000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000a1','director','10000000-0000-0000-0000-000000000009'),
 ('20000000-0000-0000-0000-000000000007','30000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-0000000000b1','director',null),
 ('20000000-0000-0000-0000-000000000008','30000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-0000000000a1','super_admin',null);

-- Aplica la migración DOS veces (idempotente)
\i supabase/migrations/20261015000000_payslips.sql
\i supabase/migrations/20261015000000_payslips.sql

-- Comprobantes de prueba (como service_role/superusuario)
insert into payslips (id, school_id, staff_id, period_key, run, employee_name, gross, afp, total_deductions, net, published_at) values
 ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001',202610,'Q1','Docente 1',10000,287,287,9713, now()),
 ('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000002',202610,'Q1','Docente 2',12000,344.4,344.4,11655.6, now()),
 ('40000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001',202610,'Q2','Docente 1',10000,287,287,9713, null);

create or replace function t_as(uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid, true); end $$;
grant execute on function t_as(text) to authenticated;

create or replace function t_count(q text) returns int language plpgsql as $$
declare n int; begin execute q into n; return n; end $$;
grant execute on function t_count(text) to authenticated;

-- 1) Cada docente ve SOLO su comprobante publicado
begin; set local role authenticated; select t_as('30000000-0000-0000-0000-000000000001');
do $$ begin
  if t_count('select count(*) from payslips') <> 1 then raise exception 'FALLA 1a: docente 1 debe ver exactamente 1 (publicado propio), ve %', t_count('select count(*) from payslips'); end if;
  if t_count($q$select count(*) from payslips where id='40000000-0000-0000-0000-000000000003'$q$) <> 0 then raise exception 'FALLA 1b: docente ve su BORRADOR'; end if;
  if t_count($q$select count(*) from payslips where staff_id='10000000-0000-0000-0000-000000000002'$q$) <> 0 then raise exception 'FALLA 1c: docente ve el de otro'; end if;
end $$; rollback;

begin; set local role authenticated; select t_as('30000000-0000-0000-0000-000000000002');
do $$ begin if t_count('select count(*) from payslips') <> 1 then raise exception 'FALLA 2: docente 2 debe ver 1'; end if; end $$; rollback;

-- 3) Recepción (con ficha de personal pero sin comprobante), tutor y estudiante: 0
begin; set local role authenticated; select t_as('30000000-0000-0000-0000-000000000003');
do $$ begin if t_count('select count(*) from payslips') <> 0 then raise exception 'FALLA 3a: recepción ve comprobantes ajenos'; end if; end $$; rollback;
begin; set local role authenticated; select t_as('30000000-0000-0000-0000-000000000004');
do $$ begin if t_count('select count(*) from payslips') <> 0 then raise exception 'FALLA 3b: tutor ve comprobantes'; end if; end $$; rollback;
begin; set local role authenticated; select t_as('30000000-0000-0000-0000-000000000005');
do $$ begin if t_count('select count(*) from payslips') <> 0 then raise exception 'FALLA 3c: estudiante ve comprobantes'; end if; end $$; rollback;

-- 4) Directora ve los 3 (incluido el borrador); director de OTRO colegio 0; super_admin ve
begin; set local role authenticated; select t_as('30000000-0000-0000-0000-000000000006');
do $$ begin if t_count('select count(*) from payslips') <> 3 then raise exception 'FALLA 4a: directora debe ver 3'; end if; end $$; rollback;
begin; set local role authenticated; select t_as('30000000-0000-0000-0000-000000000007');
do $$ begin if t_count('select count(*) from payslips') <> 0 then raise exception 'FALLA 4b: director de otro colegio ve comprobantes'; end if; end $$; rollback;
begin; set local role authenticated; select t_as('30000000-0000-0000-0000-000000000008');
do $$ begin if t_count('select count(*) from payslips') <> 3 then raise exception 'FALLA 4c: super_admin debe ver 3'; end if; end $$; rollback;

-- 5) Un docente NO puede crear, editar ni borrar
begin; set local role authenticated; select t_as('30000000-0000-0000-0000-000000000001');
do $$
declare ok boolean := false; n int;
begin
  begin
    insert into payslips (school_id, staff_id, period_key, run, employee_name, gross, total_deductions, net)
    values ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001',202611,'M','x',1,0,1);
  exception when others then ok := true; end;
  if not ok then raise exception 'FALLA 5a: un docente pudo insertar un comprobante'; end if;
  update payslips set net = 999999, gross = 999999 where id='40000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count; if n <> 0 then raise exception 'FALLA 5b: un docente pudo editar su comprobante'; end if;
  begin
    delete from payslips where id='40000000-0000-0000-0000-000000000001';
    get diagnostics n = row_count; if n <> 0 then raise exception 'FALLA 5c: un docente pudo borrar'; end if;
  exception when insufficient_privilege then null; end;
end $$; rollback;

-- 6) Dirección: inserta, edita borrador, publica; publicado NO se edita; retirar y corregir sí; nunca borra
begin; set local role authenticated; select t_as('30000000-0000-0000-0000-000000000006');
do $$
declare n int; blocked boolean := false;
begin
  insert into payslips (id, school_id, staff_id, period_key, run, employee_name, gross, afp, total_deductions, net)
  values ('40000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000003',202610,'Q1','Secretaria',8000,229.6,229.6,7770.4);
  update payslips set gross = 8100, net = 7870.4 where id='40000000-0000-0000-0000-000000000004';
  get diagnostics n = row_count; if n <> 1 then raise exception 'FALLA 6a: no pudo editar un borrador'; end if;
  update payslips set published_at = now() where id='40000000-0000-0000-0000-000000000004';
  begin
    update payslips set net = 1, gross = 1, afp=0, total_deductions=0 where id='40000000-0000-0000-0000-000000000004';
  exception when sqlstate '23514' then blocked := true; end;
  if not blocked then raise exception 'FALLA 6b: se pudo editar un comprobante PUBLICADO'; end if;
  update payslips set notified_at = now() where id='40000000-0000-0000-0000-000000000004';
  get diagnostics n = row_count; if n <> 1 then raise exception 'FALLA 6c: no pudo marcar notificado'; end if;
  update payslips set published_at = null where id='40000000-0000-0000-0000-000000000004';
  update payslips set gross = 8200, net = 7970.4 where id='40000000-0000-0000-0000-000000000004';
  get diagnostics n = row_count; if n <> 1 then raise exception 'FALLA 6d: no pudo corregir tras retirar'; end if;
  begin
    delete from payslips where id='40000000-0000-0000-0000-000000000004';
    get diagnostics n = row_count; if n <> 0 then raise exception 'FALLA 6e: dirección pudo BORRAR'; end if;
  exception when insufficient_privilege then null; end;
end $$; rollback;

-- 7) La cuenta debe cuadrar (neto = ganado - deducciones + retiro)
begin; set local role authenticated; select t_as('30000000-0000-0000-0000-000000000006');
do $$
declare bad boolean := false;
begin
  begin
    insert into payslips (school_id, staff_id, period_key, run, employee_name, gross, total_deductions, net)
    values ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000003',202612,'M','x',1000,100,950);
  exception when sqlstate '23514' then bad := true; end;
  if not bad then raise exception 'FALLA 7: aceptó un neto que no cuadra'; end if;
end $$; rollback;

-- 8) Constancia de vistas: solo la propia, solo de un comprobante publicado propio
begin; set local role authenticated; select t_as('30000000-0000-0000-0000-000000000001');
do $$
declare bad boolean := false;
begin
  insert into payslip_views (payslip_id, profile_id) values ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
  begin insert into payslip_views (payslip_id, profile_id) values ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001'); exception when others then bad := true; end;
  if not bad then raise exception 'FALLA 8a: registró vista de un comprobante ajeno'; end if;
  bad := false;
  begin insert into payslip_views (payslip_id, profile_id) values ('40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001'); exception when others then bad := true; end;
  if not bad then raise exception 'FALLA 8b: registró vista de un borrador'; end if;
  bad := false;
  begin insert into payslip_views (payslip_id, profile_id) values ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002'); exception when others then bad := true; end;
  if not bad then raise exception 'FALLA 8c: registró vista a nombre de otra persona'; end if;
end $$; rollback;

-- 9) Vínculo Excel->personal: solo dirección de su colegio
insert into payslip_staff_map (school_id, excel_id, staff_id) values ('00000000-0000-0000-0000-0000000000a1','E001','10000000-0000-0000-0000-000000000001');
begin; set local role authenticated; select t_as('30000000-0000-0000-0000-000000000001');
do $$ begin if t_count('select count(*) from payslip_staff_map') <> 0 then raise exception 'FALLA 9a: docente ve el mapa'; end if; end $$; rollback;
begin; set local role authenticated; select t_as('30000000-0000-0000-0000-000000000007');
do $$ begin if t_count('select count(*) from payslip_staff_map') <> 0 then raise exception 'FALLA 9b: director de otro colegio ve el mapa'; end if; end $$; rollback;
begin; set local role authenticated; select t_as('30000000-0000-0000-0000-000000000006');
do $$ begin if t_count('select count(*) from payslip_staff_map') <> 1 then raise exception 'FALLA 9c: directora no ve su mapa'; end if; end $$; rollback;

-- 10) anon no toca nada
begin; set local role anon;
do $$ declare bad boolean := false; begin
  begin perform 1 from payslips; exception when insufficient_privilege then bad := true; end;
  if not bad then raise exception 'FALLA 10: anon puede leer payslips'; end if;
end $$; rollback;

\echo 'TODAS LAS COMPROBACIONES DE payslips PASARON'

-- 11) La app registra la vista con INSERT ... ON CONFLICT DO NOTHING (upsert con ignoreDuplicates):
--     solo hace falta INSERT, y repetirla no falla ni duplica.
begin; set local role authenticated; select t_as('30000000-0000-0000-0000-000000000001');
do $$
declare n int;
begin
  insert into payslip_views (payslip_id, profile_id) values ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001')
    on conflict (payslip_id, profile_id) do nothing;
  insert into payslip_views (payslip_id, profile_id) values ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001')
    on conflict (payslip_id, profile_id) do nothing;
  select count(*) into n from payslip_views where payslip_id='40000000-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'FALLA 11: la vista se duplicó o no se registró (%)', n; end if;
end $$; rollback;

\echo 'PRUEBA 11 (upsert de vistas) OK'
