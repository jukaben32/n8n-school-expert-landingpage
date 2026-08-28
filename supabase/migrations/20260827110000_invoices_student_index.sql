-- =========================================================================
-- Índice faltante en invoices.student_id -- causaba "canceling statement
-- due to statement timeout" en /dashboard/tesoreria/cuentas-por-cobrar
--
-- `calculate_receivable_status` consulta `invoices where student_id = ...`
-- para cada estudiante, y `list_school_receivables` la llama una vez por
-- cada inscrito del colegio (cross join lateral) -- sin índice en
-- student_id, cada una de esas consultas es un escaneo completo de la
-- tabla invoices, repetido una vez por estudiante. Los índices existentes
-- de invoices (school_id, family_id, due_date) no cubren esta consulta.
-- =========================================================================

create index if not exists idx_invoices_student on invoices(student_id) where deleted_at is null;
