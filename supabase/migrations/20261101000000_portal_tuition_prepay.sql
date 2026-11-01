-- =========================================================================
-- Portal Familiar: mensualidad pendiente visible y pago de meses por
-- adelantado con tarjeta (Azul), con descuento por pago adelantado.
--
-- Pedido del colegio (2026-11-01):
-- - El padre debe ver en el Portal Familiar el monto pendiente de la
--   mensualidad a partir del día 25, igual que Tesorería → Cuentas por
--   Cobrar (misma función, calculate_receivable_breakdown).
-- - El padre puede pagar meses por adelantado, y si el colegio tiene un
--   descuento por pago adelantado, se le muestra y se le aplica.
--
-- Qué cambia aquí:
-- 1. invoices.prepay_discount_amount: el descuento por pago adelantado va
--    en su PROPIA columna (no en discount_amount, que ya usa el descuento
--    por hermanos). La mensualidad base de student_tuition_basis ya viene
--    con el descuento por hermanos, así que el motor nunca mira
--    discount_amount; sí debe sumar el descuento adelantado para que un
--    mes pagado con descuento cuente como cuota COMPLETA y no deje un
--    saldo fantasma igual al descuento.
-- 2. schools.prepay_enabled / prepay_discount_tiers: la configuración del
--    colegio (Configuración → Operaciones). Sin niveles, el adelanto se
--    ofrece sin descuento.
-- 3. azul_transactions puede pagar mensualidades SIN factura previa: el
--    colegio no factura por adelantado (contabilidad por lo percibido),
--    así que la factura "pagado" se crea solo cuando Azul aprueba y la
--    firma se verifica -- igual que recordExternalPayment en Tesorería.
--    Un pago cancelado o declinado no deja facturas pendientes sueltas.
-- 4. calculate_receivable_status / calculate_receivable_breakdown: copia
--    exacta de 20260930000000 con UNA línea distinta en cada una (la suma
--    de lo cobrado incluye prepay_discount_amount). Ninguna factura
--    existente tiene ese campo distinto de 0, así que los saldos actuales
--    no cambian.
-- =========================================================================

-- ── 1. Descuento por pago adelantado, aparte del de hermanos ─────────────
alter table invoices
  add column if not exists prepay_discount_amount numeric(12,2) not null default 0;

alter table invoices drop constraint if exists invoices_prepay_discount_nonnegative;
alter table invoices
  add constraint invoices_prepay_discount_nonnegative check (prepay_discount_amount >= 0);

comment on column invoices.prepay_discount_amount is
  'Descuento por pago adelantado de meses (portal familiar). Cuenta como cobrado en Cuentas por Cobrar: total_amount + prepay_discount_amount = cuotas cubiertas.';

-- ── 2. Configuración del colegio ─────────────────────────────────────────
alter table schools
  add column if not exists prepay_enabled boolean not null default true;

-- Lista de niveles: [{"months": 3, "percent": 5}, {"months": 10, "percent": 10}]
-- Se aplica el nivel más alto cuyo "months" sea <= meses adelantados.
alter table schools
  add column if not exists prepay_discount_tiers jsonb not null default '[]'::jsonb;

alter table schools drop constraint if exists schools_prepay_discount_tiers_array;
alter table schools
  add constraint schools_prepay_discount_tiers_array check (jsonb_typeof(prepay_discount_tiers) = 'array');

-- ── 3. Transacciones de Azul para mensualidades sin factura previa ───────
alter table azul_transactions alter column invoice_id drop not null;

alter table azul_transactions
  add column if not exists family_id uuid references families(id),
  add column if not exists student_id uuid references students(id),
  add column if not exists tuition_plan jsonb;

alter table azul_transactions drop constraint if exists azul_transactions_target_check;
alter table azul_transactions
  add constraint azul_transactions_target_check check (
    invoice_id is not null
    or (family_id is not null and student_id is not null and tuition_plan is not null)
  );

create index if not exists idx_azul_transactions_family on azul_transactions(family_id);

-- El tutor sigue viendo solo lo de su familia: por la factura (como antes)
-- o, para mensualidades sin factura previa, por family_id.
alter policy "azul_transactions_guardian_read" on azul_transactions
using (
    invoice_id in (
        select i.id from invoices i
        join families f on f.id = i.family_id
        join guardians g on g.family_id = f.id
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
    or family_id in (
        select g.family_id from guardians g
        join users_profiles up on up.guardian_id = g.id
        where up.auth_id = auth.uid()
    )
);

-- ── 4. Motor de Cuentas por Cobrar (una línea distinta en cada función) ──
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

    select coalesce(sum(i.total_amount + coalesce(i.prepay_discount_amount, 0)), 0) into v_collected
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

    select coalesce(sum(i.total_amount + coalesce(i.prepay_discount_amount, 0)), 0) into v_collected
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


-- Mismos permisos que 20260930000000 (create or replace los conserva; se repiten por claridad).
grant execute on function calculate_receivable_breakdown(uuid, date) to authenticated, service_role;
