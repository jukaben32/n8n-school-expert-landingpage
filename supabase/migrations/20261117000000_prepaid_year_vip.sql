-- =========================================================================
-- Pago por adelantado = trato VIP (2026-11-17)
--
-- Reporte del colegio: familias que pagaron el año por adelantado aparecían
-- con deuda y hasta BLOQUEADAS en el Portal Familiar (tramo 61+). Causas
-- reales (verificadas en producción, ver AGENTS.md):
--   * un cobro anual del 14-ago nunca se importó (la primera conciliación
--     con credenciales miró solo desde el 16-ago);
--   * un cobro anual se le cargó a la hermana equivocada en la bandeja;
--   * el descuento por pago anual (5%-20%) hacía que la plataforma contara
--     el dinero a precio completo y "faltara" el descuento al final del año.
--
-- Esta migración NO toca calculate_receivable_status/_breakdown (ya suman
-- invoices.prepay_discount_amount desde 20261101000000). Agrega:
--
-- 1. student_tuition_year_status(student): ÚNICA definición de "año pagado"
--    y "al día hasta el mes X". La usan el Portal Familiar, el bloqueo por
--    mora (nunca se bloquea a quien tiene el año pagado) y el asistente.
-- 2. list_school_tuition_year_status(school): lo mismo para todo el colegio
--    (Tesorería), security invoker: la RLS decide qué ve cada rol.
-- 3. list_school_monthly_cashflow: suma también prepay_discount_amount, igual
--    que el motor de Cuentas por Cobrar (antes el gráfico del Panel quedaba
--    por debajo para quien pagó con descuento). Copia exacta de la versión
--    viva en producción con esa única línea distinta.
-- =========================================================================

create or replace function student_tuition_year_status(p_student_id uuid)
returns table(
    student_id uuid,
    annual_total numeric,
    collected_total numeric,
    year_paid boolean,
    paid_through_month date
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
    v_basis record;
    v_collected numeric;
    v_annual numeric := 0;
    v_acum numeric := 0;
    v_through date := null;
    v_cuota record;
begin
    select * into v_basis from student_tuition_basis(p_student_id);
    if v_basis.school_id is null or not v_basis.configured then
        return;
    end if;

    -- MISMA suma que calculate_receivable_breakdown (incluye el descuento
    -- por pago adelantado, que cubre cuotas sin efectivo).
    v_collected := (
        select coalesce(sum(i.total_amount + coalesce(i.prepay_discount_amount, 0)), 0)
        from invoices i
        join billing_concepts bc on bc.id = i.concept_id
        where i.student_id = p_student_id
        and i.status = 'pagado'
        and i.deleted_at is null
        and bc.recurrence = 'monthly'
        and bc.name ilike '%mensualidad%'
    );

    for v_cuota in
        select * from installment_schedule(
            v_basis.year_start_date, v_basis.installments,
            v_basis.due_day, v_basis.grace_days, v_basis.monthly_amount
        ) order by period_index
    loop
        v_annual := v_annual + v_cuota.amount;
        -- Un centavo de tolerancia por redondeos de Alegra.
        if v_collected + 0.01 >= v_annual then
            v_through := v_cuota.period_month;
        end if;
    end loop;

    return query select
        p_student_id,
        round(v_annual, 2),
        round(v_collected, 2),
        (v_annual > 0 and v_collected + 0.01 >= v_annual),
        v_through;
end;
$$;

comment on function student_tuition_year_status(uuid) is
  'Año escolar pagado (sí/no) y último mes cubierto por lo cobrado (FIFO, incluye prepay_discount_amount). Única definición de "pagó por adelantado": la usan Portal Familiar, bloqueo por mora y asistente.';

create or replace function list_school_tuition_year_status(p_school_id uuid)
returns table(
    student_id uuid,
    annual_total numeric,
    collected_total numeric,
    year_paid boolean,
    paid_through_month date
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
    select y.*
    from students s
    cross join lateral student_tuition_year_status(s.id) y
    where s.school_id = p_school_id
    and s.enrollment_status = 'inscrito'
    and s.deleted_at is null;
$$;

revoke execute on function student_tuition_year_status(uuid) from anon;
revoke execute on function list_school_tuition_year_status(uuid) from anon;

-- ── 3. Gráfico del Panel: contar el descuento por pago adelantado ────────
create or replace function list_school_monthly_cashflow(p_school_id uuid, p_as_of date default current_date)
 returns table(period_month date, due_date date, is_due boolean, is_overdue boolean, expected_amount numeric, collected_amount numeric, pending_amount numeric, overdue_amount numeric)
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
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
                   select sum(i.total_amount + coalesce(i.prepay_discount_amount, 0))
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
$function$;
