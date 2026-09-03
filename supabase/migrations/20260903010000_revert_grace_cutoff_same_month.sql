-- =========================================================================
-- Revierte el corte de "corriente" a lo que el usuario especificó
-- explícitamente desde el primer mensaje de esta tarea: "exonerados de
-- recargo hasta los día 5 de cada mes siendo esto el corriente" -- es decir,
-- el día `tuition_grace_days` del MISMO mes de la cuota, no del mes
-- siguiente como quedó en 20260827100000 (ese cambio nunca fue confirmado
-- por el usuario real; llegó por un push directo sin pasar por esta sesión
-- y contradice su propia especificación original).
--
-- Con esto también desaparece el tramo "1-5" (solo hacía falta con el corte
-- de un mes completo de gracia) -- los tramos vuelven a ser exactamente los
-- 6 que el usuario pidió: 6-9, 10-14, 15-19, 20-30, 31-60, 61+.
--
-- Se mantiene sin tocar el otro cambio de esa misma migración (la cuota
-- parcial de 10.5 va en la primera cuota del año, no en la última) -- eso
-- nunca fue parte de la queja del usuario ni contradice nada que haya dicho.
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
    oldest_overdue_due_date date,
    oldest_overdue_reference text,
    days_overdue int,
    aging_bucket text
)
language plpgsql
security invoker
as $$
declare
    v_school_id uuid;
    v_grade_level text;
    v_enrollment_status text;
    v_override numeric;
    v_level text;
    v_base_amount numeric;
    v_sibling_discount numeric;
    v_start_date date;
    v_due_day int;
    v_grace_days int;
    v_installments numeric;
    v_monthly_amount numeric;
    v_full_periods int;
    v_partial_fraction numeric;
    v_total_periods int;
    v_collected numeric;
    v_collected_remaining numeric;
    v_expected_to_date numeric := 0;
    v_oldest_due date := null;
    v_period_year int;
    v_period_month int;
    v_days_in_month int;
    v_period_due date;
    v_period_amount numeric;
    v_days_overdue int;
    v_bucket text;
    v_month_es text[] := array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
begin
    select st.school_id, st.grade_level, st.enrollment_status, st.tuition_override_amount
    into v_school_id, v_grade_level, v_enrollment_status, v_override
    from students st where st.id = p_student_id;

    if v_school_id is null or v_enrollment_status is distinct from 'inscrito' then
        return;
    end if;

    v_level := school_level_for_grade(v_grade_level);

    select sch.tuition_due_day, sch.tuition_grace_days, sch.tuition_installments_count,
           case v_level
               when 'parvulo' then sch.tuition_parvulo_amount
               when 'inicial' then sch.tuition_inicial_amount
               when 'primaria' then sch.tuition_primaria_amount
               when 'secundaria' then sch.tuition_secundaria_amount
               else null
           end
    into v_due_day, v_grace_days, v_installments, v_base_amount
    from schools sch where sch.id = v_school_id;

    select sy.start_date into v_start_date
    from school_years sy
    where sy.school_id = v_school_id and sy.is_current = true
    limit 1;

    if v_start_date is null or (v_override is null and v_base_amount is null) then
        return query select p_student_id, v_level, null::numeric, null::numeric, null::numeric,
            null::numeric, null::numeric, null::date, null::text, null::int, 'sin_configurar'::text;
        return;
    end if;

    select coalesce(sd.discount_percent, 0) into v_sibling_discount
    from calculate_sibling_discount(p_student_id) sd;

    v_monthly_amount := round(coalesce(v_override, v_base_amount) * (1 - v_sibling_discount / 100), 2);

    v_full_periods := floor(v_installments)::int;
    v_partial_fraction := v_installments - v_full_periods;
    v_total_periods := v_full_periods + (case when v_partial_fraction > 0 then 1 else 0 end);

    select coalesce(sum(i.total_amount), 0) into v_collected
    from invoices i
    join billing_concepts bc on bc.id = i.concept_id
    where i.student_id = p_student_id
    and i.status = 'pagado'
    and i.deleted_at is null
    and bc.recurrence = 'monthly'
    and bc.name ilike '%mensualidad%';

    v_collected_remaining := v_collected;

    for i in 1..v_total_periods loop
        v_period_year := extract(year from v_start_date)::int;
        v_period_month := extract(month from v_start_date)::int + (i - 1);
        v_period_year := v_period_year + floor((v_period_month - 1) / 12.0)::int;
        v_period_month := ((v_period_month - 1) % 12) + 1;
        v_days_in_month := extract(day from (make_date(v_period_year, v_period_month, 1) + interval '1 month - 1 day'))::int;
        v_period_due := make_date(v_period_year, v_period_month, least(v_due_day, v_days_in_month));

        -- La cuota parcial (ej. 0.5) es la PRIMERA (agosto, el mes en que
        -- arranca el periodo escolar) -- sin cambios respecto a 20260827100000.
        v_period_amount := case when i = 1 and v_partial_fraction > 0
                                 then round(v_monthly_amount * v_partial_fraction, 2)
                                 else v_monthly_amount end;

        if v_period_due <= p_as_of then
            v_expected_to_date := v_expected_to_date + v_period_amount;
            if v_collected_remaining >= v_period_amount then
                v_collected_remaining := v_collected_remaining - v_period_amount;
            elsif v_oldest_due is null then
                v_oldest_due := v_period_due;
            end if;
        end if;
    end loop;

    if v_oldest_due is not null then
        -- Revertido: corte de "corriente" en el día `tuition_grace_days` del
        -- MISMO mes de la cuota más vieja sin cobrar (especificación
        -- original del usuario), no del mes siguiente.
        v_days_overdue := p_as_of - v_oldest_due;
        v_bucket := case
            when v_days_overdue <= v_grace_days then 'corriente'
            when v_days_overdue between 6 and 9 then '6-9'
            when v_days_overdue between 10 and 14 then '10-14'
            when v_days_overdue between 15 and 19 then '15-19'
            when v_days_overdue between 20 and 30 then '20-30'
            when v_days_overdue between 31 and 60 then '31-60'
            else '61+'
        end;
    end if;

    return query select
        p_student_id,
        v_level,
        v_monthly_amount,
        v_total_periods::numeric,
        v_expected_to_date,
        v_collected,
        greatest(v_expected_to_date - v_collected, 0),
        v_oldest_due,
        case when v_oldest_due is not null
             then v_month_es[extract(month from v_oldest_due)::int] || extract(year from v_oldest_due)::text
             else null end,
        v_days_overdue,
        v_bucket;
end;
$$;
