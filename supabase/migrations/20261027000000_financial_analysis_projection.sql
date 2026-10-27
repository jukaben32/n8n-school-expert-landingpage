-- =========================================================================
-- Análisis Financiero (Tesorería) -- Fase 1: ingreso proyectado por nivel.
--
-- SOLO AGREGA una función de lectura. No modifica ninguna tabla, policy ni
-- función existente (student_tuition_basis, installment_schedule,
-- calculate_receivable_status y list_school_monthly_cashflow quedan igual).
--
-- La función CONSUME esas reglas, no las copia: el monto neto de cada
-- estudiante sale de student_tuition_basis (nivel o beca, ya con descuento
-- por hermanos) y el total anual sale de installment_schedule (10.5 cuotas,
-- agosto parcial, julio fuera). Si la regla de cobro cambia, esto la hereda.
--
-- `security invoker`: la RLS de students/schools decide qué ve cada rol,
-- igual que list_school_monthly_cashflow. Nombre nuevo, sin sobrecargas.
-- =========================================================================
create or replace function school_income_projection_by_level(p_school_id uuid)
returns table(
    school_level text,
    students_count int,
    scholarship_count int,
    unconfigured_count int,
    list_price numeric,
    gross_monthly numeric,
    net_monthly numeric,
    net_annual numeric
)
language sql
security invoker
stable
set search_path = public, pg_temp
as $$
    with alumnos as (
        select st.id, st.tuition_override_amount
        from students st
        where st.school_id = p_school_id
        and st.enrollment_status = 'inscrito'
        and st.deleted_at is null
    ),
    por_alumno as (
        select a.id,
               coalesce(b.school_level, 'sin_nivel') as nivel,
               (a.tuition_override_amount is not null) as es_beca,
               coalesce(b.configured, false) as configurado,
               coalesce(b.monthly_amount, 0) as mensual_neto,
               coalesce((
                   select sum(s.amount)
                   from installment_schedule(
                       b.year_start_date, b.installments, b.due_day, b.grace_days, b.monthly_amount
                   ) s
               ), 0) as anual_neto
        from alumnos a
        left join lateral student_tuition_basis(a.id) b on true
    ),
    tarifas as (
        select 'parvulo'::text as nivel, sch.tuition_parvulo_amount as precio from schools sch where sch.id = p_school_id
        union all select 'inicial', sch.tuition_inicial_amount from schools sch where sch.id = p_school_id
        union all select 'primaria', sch.tuition_primaria_amount from schools sch where sch.id = p_school_id
        union all select 'secundaria', sch.tuition_secundaria_amount from schools sch where sch.id = p_school_id
    )
    select
        p.nivel,
        count(*)::int,
        count(*) filter (where p.es_beca)::int,
        count(*) filter (where not p.configurado)::int,
        t.precio,
        round(coalesce(t.precio, 0) * count(*), 2),
        round(sum(p.mensual_neto), 2),
        round(sum(p.anual_neto), 2)
    from por_alumno p
    left join tarifas t on t.nivel = p.nivel
    group by p.nivel, t.precio
    order by case p.nivel when 'parvulo' then 1 when 'inicial' then 2
                          when 'primaria' then 3 when 'secundaria' then 4 else 5 end;
$$;

comment on function school_income_projection_by_level(uuid) is
  'Ingreso teórico por nivel: matrícula inscrita, tarifa de lista, bruto (matrícula x tarifa) y neto (becas + descuento por hermanos, vía student_tuition_basis) mensual y anual (vía installment_schedule). Solo lectura. Alimenta Análisis Financiero.';
