-- =========================================================================
-- MentorIApp — Migración 034: super_admin puede leer uso de IA de TODOS
-- los colegios, no solo el suyo
--
-- Al construir el gráfico de "consumo de API por colegio" en Plataforma,
-- se encontró que ai_conversations, enrollment_form_scans y
-- vendor_invoices restringen a super_admin con el mismo patrón antiguo
-- que el resto del staff: "school_id in (mi propio school_id)". Eso
-- funciona para dirección/admin (un solo colegio), pero para super_admin
-- solo devuelve SU colegio afiliado, no los demás -- a diferencia de
-- students/staff/invoices/etc., que desde la migración 011
-- (super_admin_bypass) ya usan is_super_admin() para ver TODA la red.
--
-- whatsapp_anonymous_messages no tenía ninguna policy de lectura para
-- ningún rol autenticado (a propósito, ver migración 029) -- se agrega
-- una nueva solo para super_admin, sin tocar el resto.
-- =========================================================================

create policy "ai_conversations_super_admin_all" on ai_conversations
for all using (is_super_admin()) with check (is_super_admin());

create policy "whatsapp_anonymous_messages_super_admin_read" on whatsapp_anonymous_messages
for select using (is_super_admin());

create policy "enrollment_form_scans_super_admin_all" on enrollment_form_scans
for all using (is_super_admin()) with check (is_super_admin());

create policy "vendor_invoices_super_admin_all" on vendor_invoices
for all using (is_super_admin()) with check (is_super_admin());
