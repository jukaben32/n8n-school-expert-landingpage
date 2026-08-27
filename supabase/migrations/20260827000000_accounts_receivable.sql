-- =========================================================================
-- Cuentas por Cobrar — deuda implícita por antigüedad (sin facturar meses
-- futuros)
--
-- Contexto de negocio (confirmado con el usuario, no asumido): el colegio
-- NO factura la colegiatura de meses futuros (implicaría contabilizar por lo
-- devengado, y el colegio reporta por lo percibido) -- solo factura en el
-- momento en que llega el pago. Pero necesita ver, solo para fines de
-- análisis y gestión de cobro, cuánto debería haber cobrado a la fecha
-- ("deuda implícita") contra lo que de verdad cobró, por alumno/curso/nivel,
-- con antigüedad de la mora. Esta migración NUNCA crea facturas por su
-- cuenta -- todo lo de aquí es de solo lectura hasta que el staff decide
-- generar un cargo real (recargo por mora) desde la pantalla de Tesorería.
--
-- `billing_concepts.applies_to` ('all'|'grade'|'student', migración 004)
-- nunca se conectó a nada real -- no hay columna que diga a qué grado
-- aplica. En vez de resucitarlo, se reutiliza el mismo mecanismo ya probado
-- en Horarios/Notas: `students.grade_level` es texto libre, y
-- `gradeLevelToCategory()` (web/src/lib/schedule/gradeLevelCategory.ts) ya
-- sabe traducirlo a un nivel (parvulo/inicial/primaria/secundaria). Aquí se
-- porta esa misma lógica a SQL (`school_level_for_grade`) para poder tener
-- un monto de mensualidad distinto por nivel, configurable por colegio.
-- =========================================================================

alter table schools
  add column if not exists tuition_parvulo_amount numeric(12,2)
    check (tuition_parvulo_amount is null or tuition_parvulo_amount >= 0),
  add column if not exists tuition_inicial_amount numeric(12,2)
    check (tuition_inicial_amount is null or tuition_inicial_amount >= 0),
  add column if not exists tuition_primaria_amount numeric(12,2)
    check (tuition_primaria_amount is null or tuition_primaria_amount >= 0),
  add column if not exists tuition_secundaria_amount numeric(12,2)
    check (tuition_secundaria_amount is null or tuition_secundaria_amount >= 0),
  add column if not exists tuition_installments_count numeric(4,1) not null default 10.5
    check (tuition_installments_count > 0),
  add column if not exists tuition_due_day integer not null default 1
    check (tuition_due_day between 1 and 28),
  add column if not exists tuition_grace_days integer not null default 5
    check (tuition_grace_days >= 0),
  add column if not exists late_fee_percent numeric(5,2) not null default 5.00
    check (late_fee_percent >= 0 and late_fee_percent <= 100);

comment on column schools.tuition_installments_count is
  'Cantidad de cuotas de mensualidad del año escolar. Puede ser fraccionaria (ej. 10.5): la última cuota se cobra a esa fracción del monto mensual completo.';
comment on column schools.tuition_due_day is
  'Día del mes en que vence cada cuota de mensualidad (se ajusta al último día del mes si el mes es más corto).';
comment on column schools.tuition_grace_days is
  'Días de gracia tras el vencimiento antes de considerar la cuota "vencida" para Cuentas por Cobrar (ej. 5 = corriente hasta el día 5).';
comment on column schools.late_fee_percent is
  'Porcentaje de recargo por mora sobre el monto vencido, aplicado manualmente por el staff desde Cuentas por Cobrar (nunca automático).';

-- Colegio piloto: mensualidades reales dadas por el usuario (2026-08-27).
-- Idempotente y acotado por nombre -- si alguien ya las configuró a mano
-- desde /dashboard/colegio, esto no las pisa.
update schools set
  tuition_parvulo_amount = coalesce(tuition_parvulo_amount, 3500.00),
  tuition_inicial_amount = coalesce(tuition_inicial_amount, 3900.00),
  tuition_primaria_amount = coalesce(tuition_primaria_amount, 4100.00),
  tuition_secundaria_amount = coalesce(tuition_secundaria_amount, 4500.00)
where name = 'Gran Manantial de Sabiduría';

-- Para becas (casos mínimos, pendientes de que el usuario los suministre):
-- un monto de mensualidad propio por estudiante que ignora el monto por
-- nivel del colegio. NULL = usa el monto de su nivel (caso normal).
alter table students
  add column if not exists tuition_override_amount numeric(12,2)
    check (tuition_override_amount is null or tuition_override_amount >= 0);
comment on column students.tuition_override_amount is
  'Monto de mensualidad propio de este estudiante (becas/planes especiales). NULL = usa el monto del nivel de su colegio.';

-- ── Nivel del colegio a partir del texto libre de grade_level ────────────
-- Mismo vocabulario y mismo orden de comprobación que gradeLevelToCategory()
-- (web/src/lib/schedule/gradeLevelCategory.ts) -- "Pre Primario" es inicial,
-- no primaria, así que se descarta antes.
create or replace function school_level_for_grade(p_grade_level text)
returns text
language sql
immutable
as $$
    select case
        when v like '%parvulo%' then 'parvulo'
        when v like '%kinder%' or v ~ 'pre[[:space:]-]*primario' or v like '%inicial%' then 'inicial'
        when v like '%secundaria%' or v like '%secundario%' then 'secundaria'
        when v like '%primaria%' or v like '%primario%' then 'primaria'
        else null
    end
    from (select lower(translate(coalesce(p_grade_level, ''), 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')) as v) t
$$;

-- ── Deuda implícita de un estudiante a una fecha dada ────────────────────
-- Nunca escribe nada -- es puro cálculo. Genera las cuotas del año escolar
-- actual (school_years.is_current) desde su start_date, con el monto del
-- nivel del estudiante (o su tuition_override_amount si tiene beca) menos
-- el descuento por hermanos ya existente (calculate_sibling_discount,
-- migración 20260718), y las compara (FIFO) contra lo que ya se ha cobrado
-- de verdad (facturas pagadas del concepto "Mensualidad" de ese estudiante).
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

        v_period_amount := case when i = v_total_periods and v_partial_fraction > 0
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

-- ── Cuentas por Cobrar de todo un colegio, en una sola llamada ───────────
create or replace function list_school_receivables(p_school_id uuid, p_as_of date default current_date)
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
    oldest_overdue_due_date date,
    oldest_overdue_reference text,
    days_overdue int,
    aging_bucket text
)
language sql
security invoker
as $$
    select s.id, s.first_name, s.last_name, s.grade_level, s.family_id, r.school_level, r.monthly_amount,
           r.expected_to_date, r.collected_amount, r.overdue_amount, r.oldest_overdue_due_date,
           r.oldest_overdue_reference, r.days_overdue, r.aging_bucket
    from students s
    cross join lateral calculate_receivable_status(s.id, p_as_of) r
    where s.school_id = p_school_id
    and s.enrollment_status = 'inscrito'
    and s.deleted_at is null
$$;

revoke execute on function school_level_for_grade(text) from public;
revoke execute on function calculate_receivable_status(uuid, date) from public;
revoke execute on function list_school_receivables(uuid, date) from public;
grant execute on function school_level_for_grade(text) to authenticated, service_role;
grant execute on function calculate_receivable_status(uuid, date) to authenticated, service_role;
grant execute on function list_school_receivables(uuid, date) to authenticated, service_role;
