-- =========================================================================
-- Cuentas por Cobrar — la cuota de un mes se paga del 25 de ESE mes al 5
-- del mes SIGUIENTE (manual de familia, sección 8), y el recargo entra el
-- día 6 del mes siguiente (sección 9).
--
-- Contexto de por qué esto ha ido y venido (20260827100000 lo puso así,
-- 20260903010000 lo revirtió al mismo mes, y esta lo restaura):
--
-- El año escolar del colegio piloto empezó el 17 de AGOSTO y termina el 30
-- de junio, cobrado en 10.5 cuotas. Esa cuenta solo cierra con la media
-- cuota en agosto: 0.5 (agosto) + 10 completas (septiembre a junio) = 10.5.
--
-- El usuario lo confirmó explícitamente el 2026-09-03, mirando el sistema
-- en producción: "el año escolar empezó el mes pasado", "apenas estamos en
-- el primer vencimiento", "no hay nada vencido, hay una deuda corriente
-- normal hasta el día 5", y "donde dice total corriente van los pagos que
-- toca pagar desde el día 1 al día 5".
--
-- Con el corte en el mismo mes, la cuota de agosto aparecía vencida hace
-- 35 días y con las 4 etapas de recargo aplicadas (RD$773.66 en Párvulos)
-- -- números que no existen en la realidad del colegio.
--
-- Modelo correcto:
--   cuota del mes X  ->  ventana de pago: 25 de X hasta el 5 de X+1
--                        vencimiento efectivo: día 1 de X+1
--                        corriente:       día 1 al 5 de X+1
--                        recargo etapa 1: día 6 de X+1  (+5%)
--                        etapa 2:         día 10 de X+1 (+3% compuesto)
--                        etapa 3:         día 15 de X+1 (+3% compuesto)
--                        etapa 4:         día 20 de X+1 (+3% compuesto)
--
-- Consecuencia importante (confirmada por el usuario: "y solo computa
-- medio mes"): una cuota NO entra en el cálculo hasta que llega su
-- vencimiento efectivo. Hoy 3 de septiembre lo único exigible es la media
-- cuota de agosto (RD$1,750 en Párvulos), corriente; la cuota completa de
-- septiembre entra recién el 1 de octubre. Antes se contaban las dos
-- (RD$5,250) y encima como vencidas.
--
-- `days_overdue` pasa a contarse desde el día 1 del mes SIGUIENTE al de la
-- cuota (v_period_cutoff), no desde el vencimiento nominal: así el día 6
-- son 5 días y las etapas caen en los mismos números que ya usa la
-- configuración (5/9/14/19), sin importar si el mes tiene 28, 30 o 31 días.
--
-- Además corrige el desfase de un día que tenía la etiqueta del tramo: el
-- día 6 mostraba "corriente" aunque ya se le aplicaba el 5%. Ahora
-- corriente es estrictamente hasta el día 5.
-- =========================================================================

drop function if exists list_school_receivables(uuid, date);
drop function if exists calculate_receivable_status(uuid, date);

create function calculate_receivable_status(p_student_id uuid, p_as_of date default current_date)
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
    v_period_month_start date;
    v_period_due date;
    v_oldest_period_month date := null;
    v_period_amount numeric;
    v_days_overdue int;
    v_bucket text;
    v_month_es text[] := array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    v_overdue_amount numeric;
    v_multiplier numeric := 1;
    v_stage1_percent numeric;
    v_stage2_days int; v_stage2_percent numeric;
    v_stage3_days int; v_stage3_percent numeric;
    v_stage4_days int; v_stage4_percent numeric;
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
           end,
           sch.late_fee_percent,
           sch.late_fee_stage2_days, sch.late_fee_stage2_percent,
           sch.late_fee_stage3_days, sch.late_fee_stage3_percent,
           sch.late_fee_stage4_days, sch.late_fee_stage4_percent
    into v_due_day, v_grace_days, v_installments, v_base_amount,
         v_stage1_percent, v_stage2_days, v_stage2_percent,
         v_stage3_days, v_stage3_percent, v_stage4_days, v_stage4_percent
    from schools sch where sch.id = v_school_id;

    select sy.start_date into v_start_date
    from school_years sy
    where sy.school_id = v_school_id and sy.is_current = true
    limit 1;

    if v_start_date is null or (v_override is null and v_base_amount is null) then
        return query select p_student_id, v_level, null::numeric, null::numeric, null::numeric,
            null::numeric, null::numeric, null::numeric, null::date, null::text, null::int, 'sin_configurar'::text;
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
        -- Mes al que corresponde la cuota (agosto = i 1, septiembre = i 2, ...)
        v_period_year := extract(year from v_start_date)::int;
        v_period_month := extract(month from v_start_date)::int + (i - 1);
        v_period_year := v_period_year + floor((v_period_month - 1) / 12.0)::int;
        v_period_month := ((v_period_month - 1) % 12) + 1;
        v_period_month_start := make_date(v_period_year, v_period_month, 1);

        -- Se cobra el mes SIGUIENTE: la cuota de agosto se paga del 25 de
        -- agosto al 5 de septiembre, así que su vencimiento efectivo es el
        -- día 1 de septiembre (tuition_due_day del mes siguiente).
        v_days_in_month := extract(day from (v_period_month_start + interval '2 month - 1 day'))::int;
        v_period_due := (date_trunc('month', v_period_month_start + interval '1 month')
                         + make_interval(days => least(v_due_day, v_days_in_month) - 1))::date;

        -- La cuota parcial (0.5) es la PRIMERA -- el mes en que arranca el
        -- año escolar (agosto), sin importar qué día del mes empezaron.
        v_period_amount := case when i = 1 and v_partial_fraction > 0
                                 then round(v_monthly_amount * v_partial_fraction, 2)
                                 else v_monthly_amount end;

        -- Una cuota solo entra en el cálculo cuando llega su vencimiento
        -- efectivo: hoy 3 de septiembre solo cuenta la media cuota de
        -- agosto; la de septiembre entra el 1 de octubre.
        if v_period_due <= p_as_of then
            v_expected_to_date := v_expected_to_date + v_period_amount;
            if v_collected_remaining >= v_period_amount then
                v_collected_remaining := v_collected_remaining - v_period_amount;
            elsif v_oldest_due is null then
                v_oldest_due := v_period_due;
                v_oldest_period_month := v_period_month_start;
            end if;
        end if;
    end loop;

    v_overdue_amount := greatest(v_expected_to_date - v_collected, 0);

    if v_oldest_due is not null then
        -- Los días se cuentan desde el vencimiento efectivo (día 1 del mes
        -- de cobro): el día 6 son 5 días, y las etapas (5/9/14/19) caen
        -- exactamente en los días 6/10/15/20 del manual.
        v_days_overdue := greatest(p_as_of - v_oldest_due, 0);

        v_bucket := case
            when v_days_overdue < v_grace_days then 'corriente'
            when v_days_overdue between v_grace_days and 8 then '6-9'
            when v_days_overdue between 9 and 13 then '10-14'
            when v_days_overdue between 14 and 18 then '15-19'
            when v_days_overdue between 19 and 29 then '20-30'
            when v_days_overdue between 30 and 59 then '31-60'
            else '61+'
        end;

        -- Recargo escalonado del manual (sección 9): cada etapa cruzada
        -- multiplica el saldo YA recargado por la anterior (compuesto).
        if v_days_overdue >= v_grace_days then
            v_multiplier := v_multiplier * (1 + v_stage1_percent / 100);
        end if;
        if v_days_overdue >= v_stage2_days then
            v_multiplier := v_multiplier * (1 + v_stage2_percent / 100);
        end if;
        if v_days_overdue >= v_stage3_days then
            v_multiplier := v_multiplier * (1 + v_stage3_percent / 100);
        end if;
        if v_days_overdue >= v_stage4_days then
            v_multiplier := v_multiplier * (1 + v_stage4_percent / 100);
        end if;
    end if;

    return query select
        p_student_id,
        v_level,
        v_monthly_amount,
        v_total_periods::numeric,
        v_expected_to_date,
        v_collected,
        v_overdue_amount,
        round(v_overdue_amount * (v_multiplier - 1), 2),
        v_oldest_due,
        -- La referencia es el MES DE LA CUOTA (ago2026), no el mes en que
        -- se cobra (sep2026) -- es lo que el staff reconoce en el recibo.
        case when v_oldest_period_month is not null
             then v_month_es[extract(month from v_oldest_period_month)::int] || extract(year from v_oldest_period_month)::text
             else null end,
        v_days_overdue,
        v_bucket;
end;
$$;

create function list_school_receivables(p_school_id uuid, p_as_of date default current_date)
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
    select s.id, s.first_name, s.last_name, s.grade_level, s.family_id, r.school_level, r.monthly_amount,
           r.expected_to_date, r.collected_amount, r.overdue_amount, r.late_fee_amount, r.oldest_overdue_due_date,
           r.oldest_overdue_reference, r.days_overdue, r.aging_bucket
    from students s
    cross join lateral calculate_receivable_status(s.id, p_as_of) r
    where s.school_id = p_school_id
    and s.enrollment_status = 'inscrito'
    and s.deleted_at is null;
end;
$$;

revoke execute on function calculate_receivable_status(uuid, date) from public;
revoke execute on function list_school_receivables(uuid, date) from public;
grant execute on function calculate_receivable_status(uuid, date) to authenticated, service_role;
grant execute on function list_school_receivables(uuid, date) to authenticated, service_role;
