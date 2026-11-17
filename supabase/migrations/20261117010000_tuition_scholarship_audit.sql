-- =========================================================================
-- Becas: quién la autorizó, cuándo y por qué (2026-11-17)
--
-- students.tuition_override_amount (cuota mensual propia del estudiante)
-- existe desde 20260827000000, pero no había pantalla para cargarla ni
-- rastro de quién la decidió. Una beca es dinero que el colegio deja de
-- cobrar: tiene que quedar escrito el motivo y quién la autorizó.
--
-- Solo agrega columnas. No cambia ningún monto ni ninguna función:
-- student_tuition_basis sigue usando tuition_override_amount igual que antes
-- (y el descuento por hermanos se sigue aplicando encima, comportamiento
-- vigente que la Política de descuentos deja documentado para confirmar).
-- =========================================================================

alter table students add column if not exists tuition_override_reason text;
alter table students add column if not exists tuition_override_set_by uuid references users_profiles(id);
alter table students add column if not exists tuition_override_set_at timestamptz;

alter table students drop constraint if exists students_tuition_override_nonnegative;
alter table students add constraint students_tuition_override_nonnegative
  check (tuition_override_amount is null or tuition_override_amount >= 0);

comment on column students.tuition_override_reason is
  'Motivo de la beca / cuota especial (obligatorio al cargarla desde la ficha del estudiante).';
comment on column students.tuition_override_set_by is
  'Perfil de dirección que autorizó la beca / cuota especial.';
