-- =========================================================================
-- Recargo por mora: solo existe DENTRO del ciclo de cobro de su cuota.
--
-- Regla del colegio (2026-09-29, dicha por el usuario):
-- - La cuota del mes X se cobra del 25 de X al 5 de X+1, sin recargo.
-- - Del 6 al 24 de X+1 lleva recargo: 5% + 3% + 3% + 3%, SUMA simple,
--   máximo 14%.
-- - El 25 de X+1 empieza el ciclo nuevo: el recargo de la cuota X
--   DESAPARECE, no se traslada. La deuda de la cuota sigue, el recargo no.
--
-- Ejemplo: debe agosto (RD$2,050). El 10-sep lleva 8% de agosto. El 29-sep
-- (ciclo de septiembre) no lleva ningún recargo. El 20-oct lleva 14% solo
-- de septiembre, nunca de agosto.
--
-- Único cambio respecto a 20260929000000: la condición del recargo exige
-- además que no haya empezado el ciclo siguiente (día 25 de X+1).
-- Misma firma y columnas. Para revertir: volver a aplicar 20260929000000.
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

    -- Estudiante inexistente o no inscrito: no devuelve nada (igual que antes).
    if v_basis.school_id is null then
        return;
    end if;

    -- Sin año escolar en curso o sin mensualidad del nivel configurada.
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
        -- Entra desde el día 25 del mes de la cuota (period_month es día 1).
        if (v_cuota.period_month + 24) <= p_as_of then
            v_expected_to_date := v_expected_to_date + v_cuota.amount;

            -- Cuota más vieja sin cubrir (misma lógica que antes: define la
            -- antigüedad, el tramo y la referencia que se muestran).
            if v_collected_remaining >= v_cuota.amount then
                v_collected_remaining := v_collected_remaining - v_cuota.amount;
            elsif v_oldest_due is null then
                v_oldest_due := v_cuota.due_date;
                v_oldest_period_month := v_cuota.period_month;
            end if;

            -- Recargo de ESTA cuota, solo sobre la parte que sigue sin
            -- pagar (los pagos cubren primero la cuota más vieja).
            v_applied := least(v_fifo_remaining, v_cuota.amount);
            v_fifo_remaining := v_fifo_remaining - v_applied;
            v_unpaid := v_cuota.amount - v_applied;

            if v_unpaid > 0 then
                v_cuota_days := p_as_of - v_cuota.due_date;
                -- Dentro de su periodo corriente (hasta el día 5): sin recargo.
                -- Porcentajes SUMADOS, no compuestos (regla del colegio):
                -- 5% + 3% + 3% + 3% = máximo 14% sobre ESA cuota.
                -- ...y solo hasta el día 24 de X+1: el 25 empieza el ciclo nuevo
                -- y el recargo de esta cuota ya no se traslada.
                if v_cuota_days >= v_basis.grace_days
                   and p_as_of < ((v_cuota.period_month + interval '1 month')::date + 24) then
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
        -- La referencia es el MES DE LA CUOTA (ago2026), no el mes en que
        -- se cobra (sep2026) -- es lo que el staff reconoce en el recibo.
        case when v_oldest_period_month is not null
             then v_month_es[extract(month from v_oldest_period_month)::int] || extract(year from v_oldest_period_month)::text
             else null end,
        v_days_overdue,
        v_bucket;
end;
$$;
