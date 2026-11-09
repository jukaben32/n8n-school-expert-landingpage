-- =========================================================================
-- Conciliación Alegra: nuevo motivo de revisión 'nota_distinta'.
--
-- Caso real (2026-10-07, familia Felipe Frias): e-CF E310000000099 a nombre
-- de la madre, con nota "para Analia Victoria Felipe Frias". Analia todavía
-- no estaba dada de alta (se creó el 2026-10-19), así que Oliver era el
-- único inscrito de esa familia y el motor cargó el pago solo... a Oliver.
--
-- Desde ahora, si la nota escrita en Alegra nombra a otra persona que no es
-- el estudiante emparejado, el cobro va a la bandeja con este motivo en vez
-- de cargarse solo. Solo amplía el CHECK: es compatible con el código viejo.
-- Idempotente.
-- =========================================================================

alter table alegra_payment_matches
  drop constraint if exists alegra_payment_matches_reason_check;

alter table alegra_payment_matches
  add constraint alegra_payment_matches_reason_check
  check (reason in ('sin_emparejar','ambiguo','aproximado','posible_duplicado','conjunto','nota_distinta'));
