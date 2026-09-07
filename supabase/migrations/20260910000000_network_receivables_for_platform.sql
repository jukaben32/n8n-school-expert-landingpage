-- =========================================================================
-- Morosidad real para Plataforma (vista multi-colegio del super_admin)
--
-- Plataforma calculaba "% morosidad" por colegio leyendo
-- invoices.status = 'pendiente'/'vencido' -- el mismo motor que ya se
-- reemplazó en el Panel y Cuentas por Cobrar el 2026-09-07 porque nada en
-- el sistema escribe jamás esos estados (la única escritura de status es
-- -> 'pagado'). Medido en producción: para el único colegio afiliado,
-- ambos conteos dan 0 -- así que "% morosidad" mostraba siempre 0%,
-- ocultando la deuda real (~RD$441K) que sí muestran el Panel y Cuentas
-- por Cobrar.
--
-- No se reutiliza `list_school_receivables` aquí a propósito: esa función
-- exige `users_profiles.school_id = p_school_id` (ver AGENTS.md, caso
-- límite ya documentado), lo cual es correcto para Cuentas por Cobrar
-- (un director solo ve SU colegio) pero rompería Plataforma en cuanto
-- haya un segundo colegio afiliado -- Plataforma por definición compara
-- TODOS los colegios, y el super_admin no tiene su perfil ligado a cada
-- uno. Esta función hermana relaja esa comprobación a "es super_admin",
-- sin tocar la función existente ni su uso en Cuentas por Cobrar/Panel.
create or replace function list_school_receivables_network(p_school_id uuid, p_as_of date default current_date)
returns table(
    student_id uuid,
    family_id uuid,
    school_level text,
    expected_to_date numeric,
    collected_amount numeric,
    overdue_amount numeric,
    late_fee_amount numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if not exists (
        select 1 from users_profiles
        where auth_id = auth.uid()
        and role = 'super_admin'
    ) then
        raise exception 'No autorizado para ver las cuentas por cobrar de la plataforma.';
    end if;

    return query
    select s.id, s.family_id, r.school_level,
           r.expected_to_date, r.collected_amount, r.overdue_amount, r.late_fee_amount
    from students s
    cross join lateral calculate_receivable_status(s.id, p_as_of) r
    where s.school_id = p_school_id
    and s.enrollment_status = 'inscrito'
    and s.deleted_at is null;
end;
$$;

revoke execute on function list_school_receivables_network(uuid, date) from public;
revoke execute on function list_school_receivables_network(uuid, date) from anon;
grant execute on function list_school_receivables_network(uuid, date) to authenticated, service_role;

comment on function list_school_receivables_network(uuid, date) is
  'Como list_school_receivables, pero para el super_admin comparando TODOS los colegios de la plataforma -- exige role=super_admin en vez de la coincidencia de school_id (que excluiría a todos los colegios menos el propio). Usada solo por /dashboard/plataforma.';
