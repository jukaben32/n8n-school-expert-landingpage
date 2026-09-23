-- Horario real del colegio en Preguntas frecuentes (confirmado por el usuario, 2026-09-23).
-- El faq_document decía entrada 9:00 a.m. / salida 4:00 p.m. y secretaría
-- 9:30-1:00 y 3:30-5:00, lo que contradecía la "tanda matutina". Reemplaza
-- esas tres líneas exactas; si ya no están (se corrió antes), no toca nada.
update schools
set faq_document = replace(faq_document,
$old$- Horario de entrada de alumnos: 9:00 a.m.
- Horario de salida de alumnos: 4:00 p.m.
- Horario de atención de secretaría: Lunes a Viernes, 9:30 a.m.-1:00 p.m. y 3:30 p.m.-5:00 p.m. (confirmar con secretaría si cambia).$old$,
$new$- Horario de clases (tanda matutina, lunes a viernes): Inicial de 7:15 a.m. a 12:00 p.m.; Primaria de 7:15 a.m. a 12:30 p.m.; Secundaria de 7:15 a.m. a 1:00 p.m.
- Los docentes y la Directora están en el colegio desde las 7:00 a.m.
- Horario de oficinas (secretaría): lunes a viernes, de 7:30 a.m. a 4:00 p.m.
- No se labora los días feriados de la República Dominicana.
- El último viernes de cada mes no hay clases: ese día los docentes reciben talleres de capacitación.$new$)
where name = 'Centro Educativo Gran Manantial de Sabiduría';
