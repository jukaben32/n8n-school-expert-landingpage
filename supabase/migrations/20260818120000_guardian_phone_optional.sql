-- El personal del colegio necesita poder guardar la ficha de un estudiante
-- aunque todavía no tenga el teléfono del tutor a mano (llenado masivo de
-- historial, fichas escaneadas incompletas, etc.). El teléfono deja de ser
-- obligatorio a nivel de base de datos; la app sigue mostrando el campo,
-- solo que ya no bloquea el guardado si se deja vacío.
alter table guardians alter column phone drop not null;
