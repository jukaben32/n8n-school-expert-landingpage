-- =========================================================================
-- SCHOOLOS — Corrección de puesto de personal: coordinador → administrador
--
-- Corrige la etiqueta de puesto (staff.role, campo de RRHH mostrado en el
-- módulo Personal — NO es el rol de permisos, ver users_profiles.role /
-- web/src/lib/permissions.ts) de un único registro de staff.
--
-- Alcance intencionalmente acotado a un solo id (nunca por email, que no
-- es único ni estable como filtro de una migración): confirmado en sesión
-- que el registro correcto es id 24f1848b-1fa3-438b-88ba-237d4d15daac
-- (Bethania Casilla, colegio Gran Manantial de Sabiduría). El filtro
-- adicional `and role = 'coordinator'` hace la migración idempotente --
-- si ya se aplicó, o si el puesto cambió por otra vía mientras tanto, no
-- hace nada en vez de pisar un valor inesperado.
--
-- No toca users_profiles.role (rol de permisos) en absoluto.
-- =========================================================================

update staff
set role = 'administrator',
    updated_at = now()
where id = '24f1848b-1fa3-438b-88ba-237d4d15daac'
  and role = 'coordinator';
