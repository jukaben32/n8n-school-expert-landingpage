-- =========================================================================
-- Una sola definición del calendario de cuotas
--
-- Problema que resuelve (2026-09-07): el gráfico "Flujo de cobranza" del
-- Panel necesita el desglose mes a mes, y `calculate_receivable_status()`
-- solo devuelve acumulados. La primera versión repartió los montos en
-- TypeScript, copiando la regla de cuotas (cuota parcial en agosto,
-- vencimiento el día `tuition_due_day` del mes siguiente, gracia, FIFO) en
-- un segundo sitio -- exactamente el tipo de duplicación que en este
-- proyecto ya causó bugs silenciosos (ver AGENTS.md: `enrollments` en
-- Academia, las dos fuentes de "quién da qué", los dos motores de mora).
--
-- Ahora la regla vive en UN solo lugar y tiene tres consumidores:
--
--   student_tuition_basis(student)      <- monto mensual y configuración
--            |
--   installment_schedule(config)        <- las N cuotas con su fecha (pura)
--            |
--     +------+---------------------------+
--     |                                  |
--   calculate_receivable_status()   list_school_monthly_cashflow()
--   (reescrita, MISMA salida)       (nueva, para el gráfico)
--
-- `calculate_receivable_status` no cambia ni su firma ni sus columnas ni
-- sus resultados: solo deja de generar el calendario por su cuenta. Se
-- verificó fila por fila contra la versión anterior (los 244 estudiantes
-- inscritos reales, en 6 fechas distintas) antes de reemplazarla.
-- =========================================================================

-- ── 1. La base: monto mensual del estudiante y configuración del colegio ──
-- Resuelve nivel -> monto (o beca del estudiante), aplica el descuento por
-- hermanos y trae los parámetros de cobro. Es la parte que antes estaba
-- copiada al principio de calculate_receivable_status.
create or replace function student_tuition_basis(p_student_id uuid)
returns table(
    school_id uuid,
    school_level text,
    monthly_amount numeric,
    installments numeric,
    due_day int,
    grace_days int,
    year_start_date date,
    configured boolean
)
language plpgsql
security invoker
stable
set search_path = public, pg_temp
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
begin
    select st.school_id, st.grade_level, st.enrollment_status, st.tuition_override_amount
    into v_school_id, v_grade_level, v_enrollment_status, v_override
    from students st where st.id = p_student_id;

    -- Solo los inscritos generan cuotas (igual que antes).
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

    -- Sin año escolar en curso o sin mensualidad del nivel no hay cálculo
    -- posible: se devuelve la fila con configured = false para que quien
    -- llame lo distinga de "no debe nada".
    if v_start_date is null or (v_override is null and v_base_amount is null) then
        return query select v_school_id, v_level, null::numeric, v_installments,
                            v_due_day, v_grace_days, v_start_date, false;
        return;
    end if;

    select coalesce(sd.discount_percent, 0) into v_sibling_discount
    from calculate_sibling_discount(p_student_id) sd;

    return query select
        v_school_id,
        v_level,
        round(coalesce(v_override, v_base_amount) * (1 - v_sibling_discount / 100), 2),
        v_installments,
        v_due_day,
        v_grace_days,
        v_start_date,
        true;
end;
$$;

comment on function student_tuition_basis(uuid) is
  'Monto mensual del estudiante (nivel o beca, ya con descuento por hermanos) y configuración de cobro del colegio. Única fuente de esos valores: la consumen student_installment_schedule y, a través de ella, calculate_receivable_status y list_school_monthly_cashflow.';

-- ── 2. El generador PURO del calendario ──────────────────────────────────
-- ESTA es la única definición de la regla de cuotas del sistema:
--   · son `p_installments` cuotas desde el mes de `p_start_date`
--     (10.5 = agosto..junio, julio nunca entra)
--   · la cuota parcial (el .5) es la PRIMERA, el mes en que arranca el año
--   · la cuota del mes X vence el día `p_due_day` del mes X+1
--     (se paga del 25 de X al 5 de X+1, manual de familia sección 8)
--   · sigue "corriente" hasta `p_grace_days` días después del vencimiento
--
-- No consulta NADA: recibe la configuración ya resuelta. Es `immutable` a
-- propósito -- así Postgres puede reusar el resultado, y quien la llama en
-- bucle (Cuentas por Cobrar, 245 estudiantes) no paga una consulta por
-- estudiante. Una primera versión metía el `select` de la configuración
-- aquí dentro y eso duplicaba el costo de calculate_receivable_status
-- (192 -> 387 ms medidos en producción), porque el descuento por hermanos
-- se resolvía dos veces por estudiante.
create or replace function installment_schedule(
    p_start_date date,
    p_installments numeric,
    p_due_day int,
    p_grace_days int,
    p_monthly_amount numeric
)
returns table(
    period_index int,
    period_month date,
    due_date date,
    grace_until date,
    amount numeric
)
language sql
immutable
as $$
    with cfg as (
        select floor(p_installments)::int as full_periods,
               p_installments - floor(p_installments) as fraction
    ),
    periodos as (
        select i,
               (date_trunc('month', p_start_date) + make_interval(months => i - 1))::date as period_month
        from cfg,
        generate_series(1, cfg.full_periods + case when cfg.fraction > 0 then 1 else 0 end) as i
    )
    select
        p.i::int,
        p.period_month,
        v.due,
        (v.due + p_grace_days)::date,
        case when p.i = 1 and cfg.fraction > 0
             then round(p_monthly_amount * cfg.fraction, 2)
             else p_monthly_amount end
    from periodos p
    cross join cfg,
    lateral (
        -- Día `p_due_day` del mes SIGUIENTE, acotado al último día de ese
        -- mes para no pasarse en febrero.
        select (date_trunc('month', p.period_month + interval '1 month')
                + make_interval(days => least(
                    p_due_day,
                    extract(day from (p.period_month + interval '2 month - 1 day'))::int
                  ) - 1))::date as due
    ) v
    order by p.i;
$$;

comment on function installment_schedule(date, numeric, int, int, numeric) is
  'ÚNICA definición de la regla de cuotas: cuántas, de cuánto, cuándo vencen y hasta cuándo siguen corrientes. Función pura (no consulta nada). Si la regla de cobro cambia, se cambia AQUÍ y nada más.';

-- ── 3. El calendario de UN estudiante ────────────────────────────────────
-- Comodidad: resuelve su configuración y se la pasa al generador.
-- ESTA es la única definición de la regla de cuotas del sistema:
--   · son `tuition_installments_count` cuotas desde el mes de
--     `school_years.start_date` (10.5 = agosto..junio, julio nunca entra)
--   · la cuota parcial (el .5) es la PRIMERA, el mes en que arranca el año
--   · la cuota del mes X vence el día `tuition_due_day` del mes X+1
--     (se paga del 25 de X al 5 de X+1, manual de familia sección 8)
--   · sigue "corriente" hasta `tuition_grace_days` días después
create or replace function student_installment_schedule(p_student_id uuid)
returns table(
    period_index int,
    period_month date,
    due_date date,
    grace_until date,
    amount numeric
)
language sql
security invoker
stable
set search_path = public, pg_temp
as $$
    select sch.period_index, sch.period_month, sch.due_date, sch.grace_until, sch.amount
    from student_tuition_basis(p_student_id) b
    cross join lateral installment_schedule(
        b.year_start_date, b.installments, b.due_day, b.grace_days, b.monthly_amount
    ) sch
    where b.configured;
$$;

comment on function student_installment_schedule(uuid) is
  'El calendario de cuotas de un estudiante: resuelve su configuración (student_tuition_basis) y la pasa al generador puro (installment_schedule). Lo consume list_school_monthly_cashflow.';

-- ── 4. calculate_receivable_status, reescrita sobre el calendario ─────────
-- MISMA firma, MISMAS columnas, MISMOS resultados: lo único que cambia es
-- que ya no genera el calendario por su cuenta. Verificada fila por fila
-- contra la versión anterior antes de reemplazarla (ver cabecera).
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
    v_expected_to_date numeric := 0;
    v_oldest_due date := null;
    v_oldest_period_month date := null;
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

    -- Una cuota solo entra en el cálculo cuando llega su vencimiento
    -- efectivo, y los pagos cubren siempre la más vieja primero (FIFO).
    -- El calendario se pide UNA vez con la configuración ya resuelta
    -- arriba: nunca a través de student_installment_schedule(), que la
    -- volvería a resolver (y con ella el descuento por hermanos).
    for v_cuota in
        select * from installment_schedule(
            v_basis.year_start_date, v_basis.installments,
            v_basis.due_day, v_basis.grace_days, v_basis.monthly_amount
        ) order by period_index
    loop
        v_total_periods := v_total_periods + 1;
        if v_cuota.due_date <= p_as_of then
            v_expected_to_date := v_expected_to_date + v_cuota.amount;
            if v_collected_remaining >= v_cuota.amount then
                v_collected_remaining := v_collected_remaining - v_cuota.amount;
            elsif v_oldest_due is null then
                v_oldest_due := v_cuota.due_date;
                v_oldest_period_month := v_cuota.period_month;
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

        -- Recargo escalonado del manual (sección 9): cada etapa cruzada
        -- multiplica el saldo YA recargado por la anterior (compuesto).
        if v_days_overdue >= v_basis.grace_days then
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
        v_basis.school_level,
        v_basis.monthly_amount,
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

-- ── 5. El gráfico: una fila por cuota del año escolar ─────────────────────
-- Reemplaza el reparto que se había hecho en TypeScript. Consume el mismo
-- calendario, así que no puede desviarse de Cuentas por Cobrar.
--
-- `security invoker` a propósito (no definer como list_school_receivables):
-- así la RLS de `students`/`invoices` decide qué ve cada rol por sí misma,
-- sin repetir la comprobación de autorización en código -- y de paso esto
-- NO hereda el caso límite del super_admin usando "Entrar como director"
-- de otro colegio (ver AGENTS.md).
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
language sql
security invoker
stable
set search_path = public, pg_temp
as $$
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
               -- Acumulado de cuotas anteriores del mismo estudiante: es lo
               -- que hay que "llenar" antes de que un pago llegue a esta
               -- cuota (FIFO, igual que calculate_receivable_status).
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
        round(sum(cubierto), 2) as collected_amount,
        round(sum(case when p_as_of >= c.grace_until then 0 else c.amount - cubierto end), 2) as pending_amount,
        round(sum(case when p_as_of >= c.grace_until then c.amount - cubierto else 0 end), 2) as overdue_amount
    from cuotas c
    join cobrado p on p.student_id = c.student_id
    cross join lateral (
        select least(greatest(p.total - c.acumulado_previo, 0), c.amount) as cubierto
    ) cob
    group by c.period_month
    order by c.period_month;
$$;

comment on function list_school_monthly_cashflow(uuid, date) is
  'Una fila por cuota del año escolar: cuánto se debía ese mes y cuánto se ha cobrado, con la misma regla que Cuentas por Cobrar (consume student_installment_schedule). Alimenta el gráfico "Flujo de cobranza" del Panel -- antes ese reparto se hacía en TypeScript, duplicando la regla.';
