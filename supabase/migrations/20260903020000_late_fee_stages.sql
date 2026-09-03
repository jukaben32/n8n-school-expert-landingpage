-- =========================================================================
-- Cuentas por Cobrar — recargo por mora ESCALONADO (manual de familia del
-- colegio, sección 9 "Recargos")
--
-- Hasta ahora `late_fee_percent` era un único porcentaje plano, aplicado
-- igual sin importar cuántos días llevara vencida la cuota. El manual de
-- familia real del colegio (foto aportada por el usuario, 2026-09-03)
-- define una escalera de 4 recargos dentro del mismo mes, cada uno
-- ENCIMA del saldo ya recargado por el anterior (no sobre el monto
-- original -- "sobre su cuenta a esa fecha"):
--
--   Sección 8: los pagos son del 25 al 5 de cada mes.
--   Sección 9:
--     Día 6  ->  +5% sobre la cuenta a esa fecha
--     Día 10 ->  +3% más
--     Día 15 ->  +3% más
--     Día 20 ->  +3% más
--     Si junta dos meses -> se suspende el servicio.
--
-- Con `tuition_due_day` = 1, "día 6" son 5 días de atraso, "día 10" son 9,
-- "día 15" son 14 y "día 20" son 19 -- por eso las etapas se configuran en
-- DÍAS DE ATRASO y no en día del mes: así siguen siendo correctas si el
-- colegio cambia el día de vencimiento. La etapa 1 reutiliza las columnas
-- que ya existían (`tuition_grace_days` = 5 y `late_fee_percent` = 5.00).
--
-- La suspensión por "dos meses" ya está cubierta por el bloqueo de tutores
-- en el tramo "61+" (checkGuardianOverdueBlock / proxy.ts) -- no se toca
-- aquí.
--
-- Se reconstruye calculate_receivable_status a partir de la versión de
-- 20260903010000 (cuota parcial en la PRIMERA cuota del año, corte de
-- "corriente" en el mismo mes) -- lo único que cambia es la columna nueva
-- `late_fee_amount` y su cálculo por etapas.
-- =========================================================================

alter table schools
  add column if not exists late_fee_stage2_days integer not null default 9
    check (late_fee_stage2_days >= 0),
  add column if not exists late_fee_stage2_percent numeric(5,2) not null default 3.00
    check (late_fee_stage2_percent >= 0 and late_fee_stage2_percent <= 100),
  add column if not exists late_fee_stage3_days integer not null default 14
    check (late_fee_stage3_days >= 0),
  add column if not exists late_fee_stage3_percent numeric(5,2) not null default 3.00
    check (late_fee_stage3_percent >= 0 and late_fee_stage3_percent <= 100),
  add column if not exists late_fee_stage4_days integer not null default 19
    check (late_fee_stage4_days >= 0),
  add column if not exists late_fee_stage4_percent numeric(5,2) not null default 3.00
    check (late_fee_stage4_percent >= 0 and late_fee_stage4_percent <= 100);

comment on column schools.tuition_grace_days is
  'Días de atraso que disparan la 1ra etapa de recargo (día 6 del manual = 5 días). También es el corte de "corriente" en Cuentas por Cobrar.';
comment on column schools.late_fee_percent is
  '% de la 1ra etapa de recargo (día 6 del manual), sobre el saldo vencido.';
comment on column schools.late_fee_stage2_days is 'Días de atraso para la 2da etapa (día 10 del manual = 9 días).';
comment on column schools.late_fee_stage2_percent is '% de la 2da etapa, compuesto ENCIMA del saldo ya recargado por la 1ra.';
comment on column schools.late_fee_stage3_days is 'Días de atraso para la 3ra etapa (día 15 del manual = 14 días).';
comment on column schools.late_fee_stage3_percent is '% de la 3ra etapa, compuesto sobre las anteriores.';
comment on column schools.late_fee_stage4_days is 'Días de atraso para la 4ta etapa (día 20 del manual = 19 días).';
comment on column schools.late_fee_stage4_percent is '% de la 4ta etapa, compuesto sobre las anteriores.';

-- No se puede CREATE OR REPLACE agregando una columna al tipo de retorno:
-- hay que dropear. list_school_receivables depende de ella, así que se
-- recrean las dos (la segunda conserva el SECURITY DEFINER y la
-- comprobación de autorización de 20260903000000).
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
    v_period_due date;
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
        v_period_year := extract(year from v_start_date)::int;
        v_period_month := extract(month from v_start_date)::int + (i - 1);
        v_period_year := v_period_year + floor((v_period_month - 1) / 12.0)::int;
        v_period_month := ((v_period_month - 1) % 12) + 1;
        v_days_in_month := extract(day from (make_date(v_period_year, v_period_month, 1) + interval '1 month - 1 day'))::int;
        v_period_due := make_date(v_period_year, v_period_month, least(v_due_day, v_days_in_month));

        -- La cuota parcial (ej. 0.5) es la PRIMERA (el mes en que arranca el
        -- periodo escolar) -- igual que en 20260903010000.
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

    v_overdue_amount := greatest(v_expected_to_date - v_collected, 0);

    if v_oldest_due is not null then
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

        -- Recargo escalonado del manual: cada etapa cruzada multiplica el
        -- saldo YA recargado por la etapa anterior (compuesto), no el monto
        -- original. Una etapa con 0% simplemente no suma nada.
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
        case when v_oldest_due is not null
             then v_month_es[extract(month from v_oldest_due)::int] || extract(year from v_oldest_due)::text
             else null end,
        v_days_overdue,
        v_bucket;
end;
$$;

-- Misma versión SECURITY DEFINER de 20260903000000, más late_fee_amount.
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
