# Configuración SMTP de Supabase Auth con Resend

**Fecha:** 2026-08-20
**Proyecto Supabase:** `fssjgpqisfnmnkavsyld`
**Motivo:** el correo de invitación/reset de Supabase Auth usa un servicio
compartido limitado a 2 correos/hora. Se configuró SMTP propio con Resend
para eliminar ese límite.

## Configuración aplicada (Dashboard → Authentication → Emails → SMTP Settings)

| Campo | Valor |
|---|---|
| Enable Custom SMTP | ✅ |
| Host | `smtp.resend.com` |
| Port | `587` |
| Username | `resend` |
| Password | API key de Resend `supabase-auth-smtp` (separada de la que usan las Edge Functions) |
| Sender email | `no-reply@mail.resendcegmas.com` |
| Sender name | `MentorIA` |

**Importante:** el dominio verificado en Resend es el subdominio
`mail.resendcegmas.com`, **no** `resendcegmas.com` a secas (ver
resend.com/domains). Usar el dominio raíz produce
`550 The resendcegmas.com domain is not verified`.

Rate limit de Auth (Authentication → Rate Limits → emails) subido a
`100`/hora.

## `private.app_settings`

```sql
insert into private.app_settings (key, value)
values ('resend_from_address', 'no-reply@mail.resendcegmas.com')
on conflict (key) do update set value = excluded.value, updated_at = now();
```

Ya aplicado como migración: `supabase/migrations/20260820000001_smtp_config_setup.sql`.

## Bug relacionado encontrado y corregido

Al probar una invitación real (personal/tutores), el correo se enviaba bien
pero fallaba después con `new row violates row-level security policy for
table "users_profiles"`. Causa: `inviteStaffAccess` /
`inviteByEmail` / `createPhoneBasedAccess` insertaban el nuevo
`users_profiles` con el cliente de sesión normal (sujeto a RLS) en vez del
cliente `service_role`. Corregido en:

- `web/src/app/dashboard/personal/actions.ts`
- `web/src/app/dashboard/familias/actions.ts`

## Verificar

```bash
node web/scripts/verify-smtp-config.js
```

Requiere `SUPABASE_SERVICE_ROLE_KEY` en el entorno. O simplemente invita a
un usuario real desde Authentication → Users → Invite user, y confirma en
resend.com/emails que aparece como "Delivered".
