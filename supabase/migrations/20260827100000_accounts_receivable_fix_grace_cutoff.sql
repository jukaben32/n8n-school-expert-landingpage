-- =========================================================================
-- Cuentas por Cobrar — corrección definitiva de la fecha de corte (gracia)
-- y de la cuota parcial de agosto
--
-- Dos correcciones de negocio confirmadas por el usuario el 2026-08-27,
-- después de probar la pantalla contra datos reales:
--
-- 1. La cuota parcial (0.5) del año escolar va en AGOSTO (primera cuota,
--    el periodo 2026-2027 arrancó el 17 de agosto), no en junio (última
--    cuota) como quedó en la migración anterior. Es 0.5 del valor pleno
--    de la mensualidad, sin prorratear por día exacto de inicio de clases.
--
-- 2. La fecha de corte de "corriente" NO es el día `tuition_grace_days`
--    del MISMO mes de la cuota (eso hacía que la cuota de agosto ya
--    apareciera vencida desde el 6 de agosto, mostrando una gestión de
--    cobro falsa). Según el reglamento de familia del colegio, cada cuota
--    está en corriente hasta el día `tuition_grace_days` (5) del mes
--    SIGUIENTE al de la cuota -- ej. la cuota de agosto está en corriente
--    hasta el 5 de septiembre, y el 6 de septiembre ya tiene 1 día
--    vencido. Se agrega el tramo "1-5" (antes el primer tramo empezaba en
--    "6-9", dejando sin clasificar los primeros 5 días de mora bajo el
--    nuevo corte).
--
-- Ambas correcciones viven en `calculate_receivable_status` -- se
-- reemplaza por completo (create or replace) en vez de tocar la migración
-- 20260827000000 ya aplicada.
-- =========================================================================

comment on column schools.tuition_grace_days is
  'Día del mes SIGUIENTE al de cada cuota hasta el cual esa cuota sigue "corriente" (ej. 5 = la cuota de agosto está en corriente hasta el 5 de septiembre; el 6 de septiembre ya tiene 1 día vencido). No es un conteo de días desde el vencimiento dentro del mismo mes.';

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
    v_next_month_first date;
    v_next_month_days int;
    v_grace_cutoff_date date;
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

    -- Sin año escolar marcado como actual, o sin mensualidad configurada
    -- para este nivel (y sin beca que la reemplace): no se puede calcular,
    -- se avisa explícitamente en vez de mostrar un cero engañoso.
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
        -- arranca el periodo escolar), no la última -- corregido 2026-08-27.
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
        -- Corte de "corriente": día `v_grace_days` del mes SIGUIENTE al de
        -- la cuota más vieja sin cobrar (ej. cuota de agosto -> corte 5 de
        -- septiembre; el 6 de septiembre ya tiene 1 día vencido) -- según
        -- el reglamento de familia del colegio, corregido 2026-08-27. Antes
        -- se usaba el día `v_grace_days` del MISMO mes de la cuota, lo cual
        -- mostraba la cuota de agosto como vencida desde el 6 de agosto.
        v_next_month_first := (date_trunc('month', v_oldest_due) + interval '1 month')::date;
        v_next_month_days := extract(day from (v_next_month_first + interval '1 month - 1 day'))::int;
        v_grace_cutoff_date := v_next_month_first + (least(v_grace_days, v_next_month_days) - 1);

        v_days_overdue := p_as_of - v_grace_cutoff_date;
        v_bucket := case
            when v_days_overdue <= 0 then 'corriente'
            when v_days_overdue between 1 and 5 then '1-5'
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

-- El periodo 2026-2027 del colegio piloto arrancó el 17 de agosto de 2026,
-- no el 1 de agosto -- corrige el dato guardado. Acotado por nombre exacto
-- (mismo patrón defensivo que la migración anterior), y solo pisa el valor
-- si sigue siendo el 2026-08-01 por defecto -- si alguien ya lo corrigió a
-- mano con otra fecha real, esto no lo pisa.
update school_years sy
set start_date = '2026-08-17'
from schools sch
where sy.school_id = sch.id
and sch.name = 'Centro Educativo Gran Manantial de Sabiduría'
and sy.name = '2026-2027'
and sy.start_date = '2026-08-01';
