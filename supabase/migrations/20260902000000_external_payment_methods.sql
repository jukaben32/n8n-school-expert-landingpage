-- =========================================================================
-- Registrar cobros ya realizados fuera de esta plataforma (Alegra POS, u
-- otra plataforma) -- para que Cuentas por Cobrar refleje la realidad
-- mientras los pagos en línea todavía no están habilitados aquí.
--
-- `payments.payment_method` solo aceptaba 'efectivo'/'transferencia'/
-- 'tarjeta'/'azul'/'cheque' -- ninguno identifica que el dinero ya se
-- cobró en otro sistema. Se agregan 'alegra' y 'otro' (queda todo lo
-- demás intacto, ampliación pura).
-- =========================================================================

alter table payments drop constraint if exists payments_payment_method_check;
alter table payments add constraint payments_payment_method_check
  check (payment_method in ('efectivo','transferencia','tarjeta','azul','cheque','alegra','otro'));
