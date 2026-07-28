-- =========================================================================
-- SCHOOLOS — Migración 022: ampliar los puestos de personal disponibles
--
-- El check constraint original de staff.role solo contemplaba 8 puestos
-- genéricos. Se amplía con los puestos reales que usa Gran Manantial de
-- Sabiduría: seguridad, conserjería, auxiliares, portero, secretaría
-- (general y docente), ayudante docente, administrador y psicología.
-- =========================================================================

alter table staff drop constraint if exists staff_role_check;

alter table staff add constraint staff_role_check check (
    role in (
        'director', 'coordinator', 'teacher', 'assistant', 'finance',
        'reception', 'nurse', 'admin',
        'security', 'janitor', 'cafeteria_assistant', 'cleaning_assistant',
        'doorman', 'secretary', 'teaching_secretary', 'teaching_assistant',
        'administrator', 'psychologist'
    )
);
