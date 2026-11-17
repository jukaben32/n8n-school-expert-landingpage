-- =========================================================================
-- Corrección de datos: familias que pagaron por adelantado y aparecían con
-- deuda (y bloqueadas en el Portal Familiar). 2026-11-17.
-- Requiere la migración 20261117000000_prepaid_year_vip.sql.
--
-- 1. Haziel Ernesto Astacio Barbosa: su cobro de Alegra del 14-ago
--    (e-CF E320000000378, RD$23,000, mensualidad agosto-enero) nunca se
--    importó: la primera conciliación con credenciales (15-sep) miró solo
--    desde el 16-ago. Se registra igual que la conciliación: factura
--    'pagado', sin NCF (el e-CF real ya existe en Alegra), pago 'alegra'.
-- 2. e-CF E310000000054 (RD$42,000, "AGO-JUN"): está a nombre de Joandry de
--    Jesus Arroyo Gomez y con SU matrícula (17-0034), pero el 15-sep se le
--    cargó en la bandeja a su hermana Chaimel. Se mueve a Joandry (solo
--    student_id, igual que el caso Felipe Frias del 2026-11-09).
-- 3. Pagos del año completo CON descuento por pago anual: el descuento se
--    registra en invoices.prepay_discount_amount (cubre cuotas sin
--    efectivo), así el año queda pagado y no aparece un "saldo" en mayo.
--    Solo para los cobros cuya nota en Alegra dice que son el año completo,
--    y solo si lo que falta es <= 25% del año (nunca se regala deuda real).
-- =========================================================================

-- 1. Haziel
with alumno as (
    select s.id, s.school_id, s.family_id
    from students s
    where s.student_code = '18-0047' and s.deleted_at is null
),
concepto as (
    select bc.id from billing_concepts bc, alumno a
    where bc.school_id = a.school_id and bc.recurrence = 'monthly'
    and bc.name ilike '%mensualidad%' and bc.deleted_at is null
    order by bc.created_at limit 1
),
factura as (
    insert into invoices (school_id, family_id, student_id, concept_id, description,
        amount, tax_amount, total_amount, due_date, status, paid_at, ncf, ncf_type, external_reference)
    select a.school_id, a.family_id, a.id, (select id from concepto),
        'Mensualidad — cobro ya registrado (Alegra (POS)): e-CF E320000000378 · debit-card · agosto a enero (cargado el 2026-11-17: la conciliación automática no lo leyó)',
        23000, 0, 23000, '2026-08-14', 'pagado', '2026-08-14 00:00:00+00', null, null, 'E320000000378'
    from alumno a
    where not exists (select 1 from invoices i where i.external_reference = 'E320000000378' and i.deleted_at is null)
    returning id, school_id
)
insert into payments (school_id, invoice_id, amount_paid, payment_method, paid_at, notes)
select f.school_id, f.id, 23000, 'alegra', '2026-08-14 00:00:00+00',
       'e-CF E320000000378 · debit-card · cargado el 2026-11-17 (no lo había leído la conciliación)'
from factura f;

-- 2. Joandry (el comprobante trae su nombre y su matrícula)
update invoices i
set student_id = s.id, updated_at = now()
from students s
where i.external_reference = 'E310000000054'
and i.deleted_at is null
and s.student_code = '17-0034' and s.deleted_at is null
and i.student_id is distinct from s.id;

update alegra_payment_matches
set resolution_note = coalesce(resolution_note || ' · ', '') ||
    '2026-11-17: movido de Chaimel a Joandry (el e-CF trae nombre y matrícula 17-0034 de Joandry)'
where alegra_number = 'E310000000054'
and coalesce(resolution_note, '') not like '%movido de Chaimel a Joandry%';

-- 3. Descuento por pago anual (nota de Alegra: año completo / 10.5 meses / AGO-JUN)
update invoices i
set prepay_discount_amount = round(f.annual_total - f.collected_total, 2), updated_at = now()
from (
    select inv.id, y.annual_total, y.collected_total
    from invoices inv
    cross join lateral student_tuition_year_status(inv.student_id) y
    where inv.external_reference in ('E310000000071','E310000000073','E310000000101','E320000000419','E310000000054')
    and inv.deleted_at is null
    and inv.status = 'pagado'
    and coalesce(inv.prepay_discount_amount, 0) = 0
) f
where i.id = f.id
and f.annual_total > f.collected_total
and (f.annual_total - f.collected_total) <= f.annual_total * 0.25;

-- ── Reversión (no ejecutar salvo que haya que deshacerlo) ────────────────
-- update invoices set prepay_discount_amount = 0
--   where external_reference in ('E310000000071','E310000000073','E310000000101','E320000000419','E310000000054');
-- update invoices set student_id = (select id from students where student_code = '15-0012')
--   where external_reference = 'E310000000054';
-- delete from payments where invoice_id in (select id from invoices where external_reference = 'E320000000378');
-- delete from invoices where external_reference = 'E320000000378';
