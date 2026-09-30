-- =========================================================================
-- Plataforma: cartera vencida con el mismo desglose de Tesorería
--
-- La función de red seguía leyendo `calculate_receivable_status()`, donde
-- `overdue_amount` es el principal total pendiente: mezcla cuotas vencidas y
-- cuotas corrientes. Eso inflaba la tarjeta "Cartera vencida (red)" del panel
-- de super_admin después de separar la lógica de Cuentas por Cobrar.
--
-- Se conserva la firma y las columnas antiguas para compatibilidad, y se
-- agregan las columnas nuevas del desglose: corriente, principal vencido y
-- total exigible.

drop function if exists list_school_receivables_network(uuid, date);

create function list_school_receivables_network(p_school_id uuid, p_as_of date default current_date)
returns table(
    student_id uuid,
    family_id uuid,
    school_level text,
    expected_to_date numeric,
    collected_amount numeric,
    overdue_amount numeric,
    late_fee_amount numeric,
    current_amount numeric,
    overdue_principal_amount numeric,
    total_due_amount numeric
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
    select s.id,
           s.family_id,
           r.school_level,
           r.expected_to_date,
           r.collected_amount,
           r.overdue_amount,
           r.late_fee_amount,
           r.current_amount,
           r.overdue_principal_amount,
           r.total_due_amount
    from students s
    cross join lateral calculate_receivable_breakdown(s.id, p_as_of) r
    where s.school_id = p_school_id
    and s.enrollment_status = 'inscrito'
    and s.deleted_at is null;
end;
$$;

revoke execute on function list_school_receivables_network(uuid, date) from public;
revoke execute on function list_school_receivables_network(uuid, date) from anon;
grant execute on function list_school_receivables_network(uuid, date) to authenticated, service_role;

comment on function list_school_receivables_network(uuid, date) is
  'Como list_school_receivables_breakdown, pero para el super_admin comparando TODOS los colegios de la plataforma. Devuelve corriente, principal vencido, recargo y total exigible sin exigir coincidencia de school_id.';
