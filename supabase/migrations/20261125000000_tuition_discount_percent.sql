-- =========================================================================
-- Beca en PORCENTAJE por estudiante (2026-11-25)
--
-- Reporte del colegio: "los estudiantes que tienen un porcentaje de descuento
-- no se les visualiza, aparecen con la cuota normal y cuando un padre hace un
-- pago queda debiendo el resto".
--
-- Causa: caja cobra en Alegra con descuento en la línea (ej. Mensualidad
-- RD$4,500 con 50% = RD$2,250), pero la plataforma no tenía forma de saber
-- que ese estudiante tiene beca: student_tuition_basis solo conocía la
-- cuota del nivel, una cuota fija (tuition_override_amount, que nadie había
-- cargado) y el 10% por hermanos. El cobro de RD$2,250 entraba contra una
-- cuota de RD$4,500 y el resto aparecía como deuda, con recargo y, a los 61
-- días, bloqueo del portal. Al 2026-11-25 había 4 estudiantes con beca del
-- 50% en el tramo 31-60 que se iban a bloquear el 1-dic.
--
-- El colegio piensa las becas en porcentaje, no en monto. Se agrega
-- students.tuition_discount_percent; la cuota fija sigue existiendo para
-- planes especiales. Son excluyentes: un estudiante tiene una u otra.
--
-- Regla (única definición, en student_tuition_basis):
--   cuota = coalesce(cuota_fija, cuota_del_nivel × (1 − beca%))
--           × (1 − descuento_por_hermanos%)
-- El descuento por hermanos se sigue aplicando encima, igual que con la cuota
-- fija (decisión 4 de docs/POLITICA_DESCUENTOS.md, pendiente de la dirección).
--
-- Al cambiar la cuota cambia TODO el calendario del año (también agosto, que
-- es media cuota): así lo que ya pagó la familia con la beca cuadra mes a mes.
-- =========================================================================

alter table students
  add column if not exists tuition_discount_percent numeric(5,2);

alter table students drop constraint if exists students_tuition_discount_percent_range;
alter table students add constraint students_tuition_discount_percent_range
  check (tuition_discount_percent is null or (tuition_discount_percent > 0 and tuition_discount_percent <= 100));

-- Beca en % y cuota fija no se combinan: si no, nadie sabría cuál manda.
alter table students drop constraint if exists students_tuition_override_xor_percent;
alter table students add constraint students_tuition_override_xor_percent
  check (tuition_override_amount is null or tuition_discount_percent is null);

comment on column students.tuition_discount_percent is
  'Beca en porcentaje sobre la mensualidad del nivel (0-100]. NULL = sin beca en %. Excluyente con tuition_override_amount. La asigna Dirección con motivo (tuition_override_reason / _set_by / _set_at).';

-- Misma firma, mismo security invoker y mismos grants que la versión viva
-- (copiada de producción el 2026-11-25 con pg_get_functiondef: idéntica a
-- 20260907000000). Solo cambia el cálculo del monto.
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
    v_discount_percent numeric;
    v_level text;
    v_base_amount numeric;
    v_sibling_discount numeric;
    v_start_date date;
    v_due_day int;
    v_grace_days int;
    v_installments numeric;
begin
    select st.school_id, st.grade_level, st.enrollment_status, st.tuition_override_amount,
           coalesce(st.tuition_discount_percent, 0)
    into v_school_id, v_grade_level, v_enrollment_status, v_override, v_discount_percent
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
        round(
            coalesce(v_override, v_base_amount * (1 - v_discount_percent / 100))
            * (1 - v_sibling_discount / 100), 2),
        v_installments,
        v_due_day,
        v_grace_days,
        v_start_date,
        true;
end;
$$;

comment on function student_tuition_basis(uuid) is
  'Monto mensual del estudiante: cuota fija (beca/plan especial) o cuota del nivel menos su beca en %, y encima el descuento por hermanos; más la configuración de cobro del colegio. Única fuente de esos valores: la consumen student_installment_schedule y, a través de ella, calculate_receivable_status, calculate_receivable_breakdown, student_tuition_year_status y list_school_monthly_cashflow.';
