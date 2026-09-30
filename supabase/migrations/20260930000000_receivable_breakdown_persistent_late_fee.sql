-- =========================================================================
-- Cuentas por Cobrar: separar principal vencido, corriente y recargo.
--
-- Ajuste de negocio confirmado el 2026-09-30:
-- - Cada cuota mensual es independiente.
-- - La cuota del mes X aparece como corriente desde el 25 de X hasta el 5
--   de X+1.
-- - Desde el 6 de X+1, esa cuota genera recargo simple por etapas
--   (5% + 3% + 3% + 3% = maximo 14%).
-- - El recargo queda asociado a esa cuota mientras el principal siga
--   pendiente. No desaparece cuando empieza el ciclo nuevo.
-- - No hay interes compuesto: una cuota nueva no hereda el recargo viejo.
--
-- Se mantiene la firma de calculate_receivable_status/list_school_receivables
-- para no romper Panel, Reportes, Plataforma ni el bloqueo 61+. La pantalla
-- de Cuentas por Cobrar usara la nueva list_school_receivables_breakdown(),
-- que agrega columnas para mostrar vencido/corriente/recargo/total.
-- =========================================================================

create or replace function calculate_receivable_status(p_student_id uuid, p_as_of date default current_date)
returns table(
    student_id uuid,
    school_level text,
    monthly_amount numeric,
    installments_expected numeric,
    expected_to_date numeric,
    collected_amount numeric,
    overdue_amount numeric,
    late_fee_amount numeric,
    oldest_overdue_due_date date,
    oldest_overdue_reference text,
    days_overdue int,
    aging_bucket text
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_basis record;
    v_cuota record;
    v_total_periods int := 0;
    v_collected numeric;
    v_collected_remaining numeric;
    v_fifo_remaining numeric;
    v_expected_to_date numeric := 0;
    v_oldest_due date := null;
    v_oldest_period_month date := null;
    v_days_overdue int;
    v_bucket text;
    v_month_es text[] := array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    v_overdue_amount numeric;
    v_late_fee numeric := 0;
    v_unpaid numeric;
    v_applied numeric;
    v_cuota_days int;
    v_multiplier numeric;
    v_stage1_percent numeric;
    v_stage2_days int; v_stage2_percent numeric;
    v_stage3_days int; v_stage3_percent numeric;
    v_stage4_days int; v_stage4_percent numeric;
begin
    select * into v_basis from student_tuition_basis(p_student_id);

    if v_basis.school_id is null then
        return;
    end if;

    if not v_basis.configured then
        return query select p_student_id, v_basis.school_level, null::numeric, null::numeric, null::numeric,
            null::numeric, null::numeric, null::numeric, null::date, null::text, null::int, 'sin_configurar'::text;
        return;
    end if;

    select sch.late_fee_percent,
           sch.late_fee_stage2_days, sch.late_fee_stage2_percent,
           sch.late_fee_stage3_days, sch.late_fee_stage3_percent,
           sch.late_fee_stage4_days, sch.late_fee_stage4_percent
    into v_stage1_percent, v_stage2_days, v_stage2_percent,
         v_stage3_days, v_stage3_percent, v_stage4_days, v_stage4_percent
    from schools sch where sch.id = v_basis.school_id;

    select coalesce(sum(i.total_amount), 0) into v_collected
    from invoices i
    join billing_concepts bc on bc.id = i.concept_id
    where i.student_id = p_student_id
    and i.status = 'pagado'
    and i.deleted_at is null
    and bc.recurrence = 'monthly'
    and bc.name ilike '%mensualidad%';

    v_collected_remaining := v_collected;
    v_fifo_remaining := v_collected;

    for v_cuota in
        select * from installment_schedule(
            v_basis.year_start_date, v_basis.installments,
            v_basis.due_day, v_basis.grace_days, v_basis.monthly_amount
        ) order by period_index
    loop
        v_total_periods := v_total_periods + 1;

        -- La cuota entra desde el 25 del mes de la cuota como corriente.
        if (v_cuota.period_month + 24) <= p_as_of then
            v_expected_to_date := v_expected_to_date + v_cuota.amount;

            if v_collected_remaining >= v_cuota.amount then
                v_collected_remaining := v_collected_remaining - v_cuota.amount;
            elsif v_oldest_due is null then
                v_oldest_due := v_cuota.due_date;
                v_oldest_period_month := v_cuota.period_month;
            end if;

            -- Recargo de esta cuota, solo sobre la parte de esta cuota que
            -- sigue pendiente. Los pagos cubren primero la cuota mas vieja.
            v_applied := least(v_fifo_remaining, v_cuota.amount);
            v_fifo_remaining := greatest(v_fifo_remaining - v_applied, 0);
            v_unpaid := v_cuota.amount - v_applied;

            if v_unpaid > 0 then
                v_cuota_days := p_as_of - v_cuota.due_date;

                -- Recargo simple por cuota. Se queda pegado a esta cuota
                -- mientras su principal siga pendiente; no se traslada ni
                -- desaparece al iniciar el ciclo siguiente.
                if v_cuota_days >= v_basis.grace_days then
                    v_multiplier := v_stage1_percent;
                    if v_cuota_days >= v_stage2_days then
                        v_multiplier := v_multiplier + v_stage2_percent;
                    end if;
                    if v_cuota_days >= v_stage3_days then
                        v_multiplier := v_multiplier + v_stage3_percent;
                    end if;
                    if v_cuota_days >= v_stage4_days then
                        v_multiplier := v_multiplier + v_stage4_percent;
                    end if;
                    v_late_fee := v_late_fee + v_unpaid * v_multiplier / 100;
                end if;
            end if;
        end if;
    end loop;

    v_overdue_amount := greatest(v_expected_to_date - v_collected, 0);

    if v_oldest_due is not null then
        v_days_overdue := greatest(p_as_of - v_oldest_due, 0);

        v_bucket := case
            when v_days_overdue < v_basis.grace_days then 'corriente'
            when v_days_overdue between v_basis.grace_days and 8 then '6-9'
            when v_days_overdue between 9 and 13 then '10-14'
            when v_days_overdue between 14 and 18 then '15-19'
            when v_days_overdue between 19 and 29 then '20-30'
            when v_days_overdue between 30 and 59 then '31-60'
            else '61+'
        end;
    end if;

    return query select
        p_student_id,
        v_basis.school_level,
        v_basis.monthly_amount,
        v_total_periods::numeric,
        v_expected_to_date,
        v_collected,
        v_overdue_amount,
        round(v_late_fee, 2),
        v_oldest_due,
        case when v_oldest_period_month is not null
             then v_month_es[extract(month from v_oldest_period_month)::int] || extract(year from v_oldest_period_month)::text
             else null end,
        v_days_overdue,
        v_bucket;
end;
$$;

create or replace function calculate_receivable_breakdown(p_student_id uuid, p_as_of date default current_date)
returns table(
    student_id uuid,
    school_level text,
    monthly_amount numeric,
    installments_expected numeric,
    expected_to_date numeric,
    collected_amount numeric,
    overdue_amount numeric,
    late_fee_amount numeric,
    current_amount numeric,
    overdue_principal_amount numeric,
    total_due_amount numeric,
    oldest_overdue_due_date date,
    oldest_overdue_reference text,
    days_overdue int,
    aging_bucket text
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_basis record;
    v_cuota record;
    v_total_periods int := 0;
    v_collected numeric;
    v_fifo_remaining numeric;
    v_expected_to_date numeric := 0;
    v_current_amount numeric := 0;
    v_overdue_principal numeric := 0;
    v_late_fee numeric := 0;
    v_oldest_due date := null;
    v_oldest_period_month date := null;
    v_days_overdue int;
    v_bucket text;
    v_month_es text[] := array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    v_unpaid numeric;
    v_applied numeric;
    v_cuota_days int;
    v_multiplier numeric;
    v_stage1_percent numeric;
    v_stage2_days int; v_stage2_percent numeric;
    v_stage3_days int; v_stage3_percent numeric;
    v_stage4_days int; v_stage4_percent numeric;
begin
    select * into v_basis from student_tuition_basis(p_student_id);

    if v_basis.school_id is null then
        return;
    end if;

    if not v_basis.configured then
        return query select p_student_id, v_basis.school_level, null::numeric, null::numeric, null::numeric,
            null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric,
            null::date, null::text, null::int, 'sin_configurar'::text;
        return;
    end if;

    select sch.late_fee_percent,
           sch.late_fee_stage2_days, sch.late_fee_stage2_percent,
           sch.late_fee_stage3_days, sch.late_fee_stage3_percent,
           sch.late_fee_stage4_days, sch.late_fee_stage4_percent
    into v_stage1_percent, v_stage2_days, v_stage2_percent,
         v_stage3_days, v_stage3_percent, v_stage4_days, v_stage4_percent
    from schools sch where sch.id = v_basis.school_id;

    select coalesce(sum(i.total_amount), 0) into v_collected
    from invoices i
    join billing_concepts bc on bc.id = i.concept_id
    where i.student_id = p_student_id
    and i.status = 'pagado'
    and i.deleted_at is null
    and bc.recurrence = 'monthly'
    and bc.name ilike '%mensualidad%';

    v_fifo_remaining := v_collected;

    for v_cuota in
        select * from installment_schedule(
            v_basis.year_start_date, v_basis.installments,
            v_basis.due_day, v_basis.grace_days, v_basis.monthly_amount
        ) order by period_index
    loop
        v_total_periods := v_total_periods + 1;

        if (v_cuota.period_month + 24) <= p_as_of then
            v_expected_to_date := v_expected_to_date + v_cuota.amount;

            v_applied := least(v_fifo_remaining, v_cuota.amount);
            v_fifo_remaining := greatest(v_fifo_remaining - v_applied, 0);
            v_unpaid := v_cuota.amount - v_applied;

            if v_unpaid > 0 then
                if v_oldest_due is null then
                    v_oldest_due := v_cuota.due_date;
                    v_oldest_period_month := v_cuota.period_month;
                end if;

                v_cuota_days := p_as_of - v_cuota.due_date;

                if v_cuota_days >= v_basis.grace_days then
                    v_overdue_principal := v_overdue_principal + v_unpaid;

                    v_multiplier := v_stage1_percent;
                    if v_cuota_days >= v_stage2_days then
                        v_multiplier := v_multiplier + v_stage2_percent;
                    end if;
                    if v_cuota_days >= v_stage3_days then
                        v_multiplier := v_multiplier + v_stage3_percent;
                    end if;
                    if v_cuota_days >= v_stage4_days then
                        v_multiplier := v_multiplier + v_stage4_percent;
                    end if;
                    v_late_fee := v_late_fee + v_unpaid * v_multiplier / 100;
                else
                    v_current_amount := v_current_amount + v_unpaid;
                end if;
            end if;
        end if;
    end loop;

    if v_oldest_due is not null then
        v_days_overdue := greatest(p_as_of - v_oldest_due, 0);

        v_bucket := case
            when v_days_overdue < v_basis.grace_days then 'corriente'
            when v_days_overdue between v_basis.grace_days and 8 then '6-9'
            when v_days_overdue between 9 and 13 then '10-14'
            when v_days_overdue between 14 and 18 then '15-19'
            when v_days_overdue between 19 and 29 then '20-30'
            when v_days_overdue between 30 and 59 then '31-60'
            else '61+'
        end;
    end if;

    return query select
        p_student_id,
        v_basis.school_level,
        v_basis.monthly_amount,
        v_total_periods::numeric,
        v_expected_to_date,
        v_collected,
        round(v_current_amount + v_overdue_principal, 2),
        round(v_late_fee, 2),
        round(v_current_amount, 2),
        round(v_overdue_principal, 2),
        round(v_current_amount + v_overdue_principal + v_late_fee, 2),
        v_oldest_due,
        case when v_oldest_period_month is not null
             then v_month_es[extract(month from v_oldest_period_month)::int] || extract(year from v_oldest_period_month)::text
             else null end,
        v_days_overdue,
        v_bucket;
end;
$$;

create or replace function list_school_receivables_breakdown(p_school_id uuid, p_as_of date default current_date)
returns table(
    student_id uuid,
    first_name text,
    last_name text,
    grade_level text,
    family_id uuid,
    school_level text,
    monthly_amount numeric,
    expected_to_date numeric,
    collected_amount numeric,
    overdue_amount numeric,
    late_fee_amount numeric,
    current_amount numeric,
    overdue_principal_amount numeric,
    total_due_amount numeric,
    oldest_overdue_due_date date,
    oldest_overdue_reference text,
    days_overdue int,
    aging_bucket text
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
    if not exists (
        select 1 from users_profiles
        where auth_id = auth.uid()
        and school_id = p_school_id
        and role in ('super_admin','school_admin','director','finance','reception')
    ) then
        raise exception 'No autorizado para ver las cuentas por cobrar de este colegio';
    end if;

    return query
    select s.id, s.first_name, s.last_name, s.grade_level, s.family_id,
           r.school_level, r.monthly_amount, r.expected_to_date, r.collected_amount,
           r.overdue_amount, r.late_fee_amount, r.current_amount, r.overdue_principal_amount,
           r.total_due_amount, r.oldest_overdue_due_date, r.oldest_overdue_reference,
           r.days_overdue, r.aging_bucket
    from students s
    cross join lateral calculate_receivable_breakdown(s.id, p_as_of) r
    where s.school_id = p_school_id
    and s.enrollment_status = 'inscrito'
    and s.deleted_at is null;
end;
$$;

revoke execute on function calculate_receivable_breakdown(uuid, date) from public;
revoke execute on function list_school_receivables_breakdown(uuid, date) from public;
grant execute on function calculate_receivable_breakdown(uuid, date) to authenticated, service_role;
grant execute on function list_school_receivables_breakdown(uuid, date) to authenticated, service_role;
