-- =========================================================================
-- Flujo de cobranza del Panel -- list_school_monthly_cashflow como
-- SECURITY DEFINER (el gráfico salía vacío por statement timeout)
--
-- Misma causa, documentada en 20260828000000_receivables_security_definer:
-- una función SECURITY INVOKER que recorre a TODOS los estudiantes
-- inscritos (student_tuition_basis + calculate_sibling_discount por cada
-- uno) dispara las políticas RLS de students/invoices/schools/school_years
-- /billing_concepts una vez por estudiante, y cada política hace su propia
-- subconsulta a users_profiles. Con la sesión real de un usuario (no con la
-- service_role, que se salta RLS) y ~245 estudiantes, eso choca contra el
-- statement_timeout: la RPC devuelve error, `data` queda null y el gráfico
-- se pinta sin barras ni etiquetas.
--
-- Solo cambia el modo de ejecución y se agrega la verificación de acceso
-- UNA vez al entrar (mismo criterio que list_school_receivables_breakdown,
-- que es la que alimenta las tarjetas del mismo Panel). El cálculo, la firma
-- y las columnas de salida son idénticos a 20260907000000.
--
-- De paso, un super_admin puede ver cualquier colegio (is_super_admin()),
-- así que "Entrar como director" de otro colegio tampoco rompe el gráfico.
-- =========================================================================

create or replace function list_school_monthly_cashflow(p_school_id uuid, p_as_of date default current_date)
returns table(
    period_month date,
    due_date date,
    is_due boolean,
    is_overdue boolean,
    expected_amount numeric,
    collected_amount numeric,
    pending_amount numeric,
    overdue_amount numeric
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
    if not (
        is_super_admin()
        or exists (
            select 1 from users_profiles
            where auth_id = auth.uid()
            and school_id = p_school_id
            and role in ('school_admin','director','finance','reception')
        )
    ) then
        raise exception 'No autorizado para ver el flujo de cobranza de este colegio';
    end if;

    return query
    with alumnos as (
        select st.id
        from students st
        where st.school_id = p_school_id
        and st.enrollment_status = 'inscrito'
        and st.deleted_at is null
    ),
    cobrado as (
        select a.id as student_id,
               coalesce((
                   select sum(i.total_amount)
                   from invoices i
                   join billing_concepts bc on bc.id = i.concept_id
                   where i.student_id = a.id
                   and i.status = 'pagado'
                   and i.deleted_at is null
                   and bc.recurrence = 'monthly'
                   and bc.name ilike '%mensualidad%'
               ), 0) as total
        from alumnos a
    ),
    cuotas as (
        select a.id as student_id, s.period_index, s.period_month, s.due_date, s.grace_until, s.amount,
               coalesce(sum(s.amount) over (
                   partition by a.id order by s.period_index
                   rows between unbounded preceding and 1 preceding
               ), 0) as acumulado_previo
        from alumnos a
        cross join lateral student_tuition_basis(a.id) b
        cross join lateral installment_schedule(
            b.year_start_date, b.installments, b.due_day, b.grace_days, b.monthly_amount
        ) s
        where b.configured
    )
    select
        c.period_month,
        min(c.due_date) as due_date,
        bool_or(c.due_date <= p_as_of) as is_due,
        bool_or(p_as_of >= c.grace_until) as is_overdue,
        round(sum(c.amount), 2) as expected_amount,
        round(sum(cob.cubierto), 2) as collected_amount,
        round(sum(case when p_as_of >= c.grace_until then 0 else c.amount - cob.cubierto end), 2) as pending_amount,
        round(sum(case when p_as_of >= c.grace_until then c.amount - cob.cubierto else 0 end), 2) as overdue_amount
    from cuotas c
    join cobrado p on p.student_id = c.student_id
    cross join lateral (
        select least(greatest(p.total - c.acumulado_previo, 0), c.amount) as cubierto
    ) cob
    group by c.period_month
    order by c.period_month;
end;
$$;

comment on function list_school_monthly_cashflow(uuid, date) is
  'Una fila por cuota del año escolar: cuánto se debía ese mes y cuánto se ha cobrado, con la misma regla que Cuentas por Cobrar (consume student_installment_schedule). Alimenta el gráfico "Flujo de cobranza" del Panel. SECURITY DEFINER con verificación de acceso al entrar, igual que list_school_receivables (evita el statement timeout por RLS repetida).';

revoke execute on function list_school_monthly_cashflow(uuid, date) from public;
grant execute on function list_school_monthly_cashflow(uuid, date) to authenticated, service_role;
