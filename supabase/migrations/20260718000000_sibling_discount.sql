-- =========================================================================
-- SCHOOLOS — Migración 020: descuento automático por hermanos en Tesorería
--
-- Regla de negocio (confirmada con el usuario, no asumida):
-- - Una familia con 3 o más hijos con enrollment_status = 'inscrito' recibe
--   un descuento a partir del 3er hijo (el 1ro y 2do pagan precio completo).
-- - El "orden" del hijo dentro de la familia se calcula por fecha de
--   nacimiento (el mayor es el 1ro), solo contando hermanos inscritos.
-- - El umbral (cuántos hijos disparan el descuento) y el porcentaje son
--   configurables POR COLEGIO -- no son un valor fijo de plataforma --
--   siguiendo la misma idea de `schools` como dueño de su propia
--   configuración (igual que `subdomain`, `tagline`, etc., ya son columnas
--   tipadas ahí en vez de vivir en el jsonb `settings`, que de hecho no se
--   usa en ningún lado del código -- se mantiene esa convención).
-- - Por defecto: 3+ hijos inscritos, 10% de descuento desde el 3ro.
-- =========================================================================

alter table schools
  add column if not exists sibling_discount_min_children integer not null default 3
    check (sibling_discount_min_children >= 1),
  add column if not exists sibling_discount_percent numeric(5,2) not null default 10.00
    check (sibling_discount_percent >= 0 and sibling_discount_percent <= 100);

comment on column schools.sibling_discount_min_children is
  'A partir de qué hijo (ordenado por fecha de nacimiento, solo hermanos inscritos) empieza a aplicar el descuento. Ej: 3 = el 1ro y 2do pagan completo, el 3ro en adelante recibe el descuento.';
comment on column schools.sibling_discount_percent is
  'Porcentaje de descuento aplicado a la factura de un hijo que califica (0-100).';

alter table invoices
  add column if not exists discount_percent numeric(5,2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100),
  add column if not exists discount_amount numeric(12,2) not null default 0
    check (discount_amount >= 0);

comment on column invoices.discount_amount is
  'Monto del descuento aplicado (ej. por hermanos), ya restado de total_amount. amount sigue siendo el monto base sin descontar.';

-- ── Cálculo del descuento por hermanos para un estudiante puntual ────────
-- SECURITY INVOKER (por defecto) a propósito: respeta el RLS normal de
-- `students`/`schools` -- si el usuario no puede ver a ese estudiante o
-- colegio, la función simplemente no encuentra filas, igual que cualquier
-- otra consulta hecha por ese rol.
create or replace function calculate_sibling_discount(p_student_id uuid)
returns table (
  qualifies boolean,
  sibling_rank integer,
  enrolled_siblings integer,
  discount_percent numeric
)
language sql
stable
set search_path = public, pg_temp
as $$
  with target as (
    select s.family_id, s.school_id
    from students s
    where s.id = p_student_id
      and s.deleted_at is null
  ),
  ranked_siblings as (
    select s.id, row_number() over (order by s.birth_date asc, s.created_at asc) as rnk
    from students s, target t
    where s.family_id = t.family_id
      and s.enrollment_status = 'inscrito'
      and s.deleted_at is null
  ),
  school_cfg as (
    select sch.sibling_discount_min_children as min_children,
           sch.sibling_discount_percent as percent
    from schools sch, target t
    where sch.id = t.school_id
  )
  select
    coalesce(rs.rnk >= cfg.min_children, false) as qualifies,
    rs.rnk::int as sibling_rank,
    (select count(*)::int from ranked_siblings) as enrolled_siblings,
    case when coalesce(rs.rnk >= cfg.min_children, false) then cfg.percent else 0 end as discount_percent
  from school_cfg cfg
  left join ranked_siblings rs on rs.id = p_student_id
$$;

revoke execute on function calculate_sibling_discount(uuid) from public;
grant execute on function calculate_sibling_discount(uuid) to authenticated, service_role;
