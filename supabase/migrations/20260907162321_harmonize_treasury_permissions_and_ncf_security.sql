-- Tesorería: armoniza la matriz de permisos de la app con RLS y endurece NCF.
--
-- web/src/lib/permissions.ts permite a recepción operar Tesorería básica
-- (facturar, cobrar y validar comprobantes). Producción todavía tenía
-- varias políticas antiguas sin ese rol, dejando la pantalla a medias para
-- recepción. Además generate_ncf era SECURITY DEFINER sin search_path fijo
-- y ejecutable por anon; ahora la función valida rol/colegio antes de
-- consumir la secuencia fiscal.

drop policy if exists "billing_concepts_staff" on billing_concepts;
create policy "billing_concepts_staff" on billing_concepts
for all using (
  school_id in (
    select up.school_id
    from users_profiles up
    where up.auth_id = (select auth.uid())
      and up.role in ('super_admin','school_admin','director','finance','reception')
  )
);

drop policy if exists "invoices_staff" on invoices;
create policy "invoices_staff" on invoices
for all using (
  school_id in (
    select up.school_id
    from users_profiles up
    where up.auth_id = (select auth.uid())
      and up.role in ('super_admin','school_admin','director','finance','reception')
  )
);

drop policy if exists "payments_staff" on payments;
create policy "payments_staff" on payments
for all using (
  school_id in (
    select up.school_id
    from users_profiles up
    where up.auth_id = (select auth.uid())
      and up.role in ('super_admin','school_admin','director','finance','reception')
  )
);

drop policy if exists "payment_receipts_staff_read" on payment_receipts;
create policy "payment_receipts_staff_read" on payment_receipts
for select using (
  school_id in (
    select up.school_id
    from users_profiles up
    where up.auth_id = (select auth.uid())
      and up.role in ('super_admin','school_admin','director','finance','reception')
  )
);

drop policy if exists "payment_receipts_staff_update" on payment_receipts;
create policy "payment_receipts_staff_update" on payment_receipts
for update using (
  school_id in (
    select up.school_id
    from users_profiles up
    where up.auth_id = (select auth.uid())
      and up.role in ('super_admin','school_admin','director','finance','reception')
  )
);

create or replace function generate_ncf(
  p_school_id uuid,
  p_ncf_type text default '02'
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sequence bigint;
  v_ncf text;
  v_prefix text;
  v_can_generate boolean;
begin
  if current_user = 'service_role' or current_setting('request.jwt.claim.role', true) = 'service_role' then
    v_can_generate := true;
  else
    select exists (
      select 1
      from users_profiles up
      where up.auth_id = (select auth.uid())
        and (
          up.role = 'super_admin'
          or (
            up.school_id = p_school_id
            and up.role in ('school_admin','director','finance','reception')
          )
        )
    ) into v_can_generate;
  end if;

  if not v_can_generate then
    raise exception 'No tienes permiso para generar NCF.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_school_id::text || p_ncf_type));

  if p_ncf_type = '02' then
    v_sequence := nextval('ncf_sequence_02');
    v_prefix := 'B02';
  elsif p_ncf_type = '01' then
    v_sequence := nextval('ncf_sequence_01');
    v_prefix := 'B01';
  else
    v_sequence := nextval('ncf_sequence_02');
    v_prefix := 'B' || p_ncf_type;
  end if;

  v_ncf := v_prefix || lpad(v_sequence::text, 8, '0');
  return v_ncf;
end;
$$;

revoke execute on function generate_ncf(uuid, text) from public;
revoke execute on function generate_ncf(uuid, text) from anon;
grant execute on function generate_ncf(uuid, text) to authenticated, service_role;

