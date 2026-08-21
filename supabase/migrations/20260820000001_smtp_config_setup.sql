-- Asegura que el remitente de Resend (private.app_settings.resend_from_address)
-- use el dominio realmente verificado en Resend: mail.resendcegmas.com (NO
-- resendcegmas.com a secas -- ver resend.com/domains, confirmado 2026-08-20).
-- No toca la config SMTP de Supabase Auth: eso solo se puede activar desde
-- el Dashboard (Authentication → Emails → SMTP Settings), no hay forma de
-- hacerlo por SQL.

insert into private.app_settings (key, value)
values ('resend_from_address', 'no-reply@mail.resendcegmas.com')
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();
