-- =========================================================================
-- MENTORIAPP — Migración: el colegio puede leer las conversaciones del
-- asistente de IA (chat, nota de voz, llamada en vivo)
--
-- Decisión de producto REVERTIDA respecto a la migración 019 (que decía
-- explícitamente "el personal del colegio no tiene ninguna política de
-- lectura sobre esta tabla, ni siquiera director"). El usuario confirmó
-- el 2026-08 que sí quiere que director/school_admin/super_admin puedan
-- verlas -- con la condición explícita de avisarle al padre en la propia
-- interfaz (ver FamilyChatWidget.tsx / VoiceCallWidget.tsx) que el
-- colegio puede revisar la conversación, para no sorprenderlo después.
--
-- Alcance de roles: solo director/school_admin/super_admin -- NO
-- teacher/finance/reception. Las conversaciones pueden tocar temas
-- financieros o de salud de la familia; se restringe al mismo nivel que
-- Personal/Configuración del colegio (FULL_ACCESS en permissions.ts),
-- no a todo el staff. Ajustar si el usuario decide lo contrario.
-- =========================================================================

drop policy if exists "ai_conversations_staff_read" on ai_conversations;
create policy "ai_conversations_staff_read" on ai_conversations
for select using (
    school_id in (
        select school_id from users_profiles
        where auth_id = auth.uid() and role in ('super_admin','school_admin','director')
    )
);
