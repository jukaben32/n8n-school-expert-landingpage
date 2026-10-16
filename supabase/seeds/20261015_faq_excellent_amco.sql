-- Exámenes de inglés en Excellent (Amco) para el asistente de IA de las familias.
-- Agrega la sección al final de schools.faq_document SOLO si no está ya
-- (reejecutable sin duplicar). El texto sale de web/src/lib/amco/excellentEmail.ts
-- (EXCELLENT_FAQ_SECTION); si se cambia allá, hay que actualizarlo aquí.
-- No lleva correos de estudiantes: el asistente los ve por familia, desde
-- amco_student_accounts (ver gatherFamilyContext).
update schools
set faq_document = rtrim(coalesce(faq_document, '')) || E'\n\n' || $faq$EXÁMENES DE INGLÉS EN LA PLATAFORMA EXCELLENT (AMCO) — PERÍODO 2026-2027
Los exámenes de inglés se hacen en Excellent, la plataforma de trabajo de Amco para los estudiantes. Lo coordina la Coordinación del Área de Inglés del colegio.
- Quiénes: el examen es para los estudiantes de 3ro de Primaria a 6to de Secundaria. 1ro y 2do de Primaria e Inicial no lo toman; si el padre pregunta por ellos, decir que este examen es solo a partir de 3ro de Primaria.
- Enlace de la plataforma: https://app.eecertification.com/
- El sitio web del colegio (https://www.educacionmanantial.com/colegio/gran-manantial-de-sabiduria) tiene el enlace a Amco, y ahí también pueden conocer más de los programas y servicios del colegio.
- Hay que descargar la aplicación de Excellent en un teléfono o tableta compatible: los exámenes se hacen en la aplicación.
- Usuario: el correo de Amco del estudiante (cada estudiante tiene el suyo, con vigencia durante todo el período escolar 2026-2027). El asistente puede darle a la familia el correo de Amco de SUS hijos si aparece en los datos de la familia; nunca el de otros estudiantes.
- Contraseña: 12345678 (del 1 al 8), igual para todos.
- Video con el paso a paso para entrar: https://youtu.be/qNFdgJy3NH4?feature=shared
- Los estudiantes deben tomar una evaluación del período. Los padres deben darles en casa el apoyo que necesiten para hacerla.
- Antes de que lleguen los exámenes se pide entrar a la plataforma y comprobar que el acceso funciona.
- Fecha de los exámenes: todavía no está definida. La Coordinación del Área de Inglés avisará por correo cuándo comenzar; los estudiantes deben esperar esa autorización antes de iniciar cualquier examen. Si el padre pregunta la fecha, decir exactamente eso; no inventar fechas.
- Si el correo de Amco de un hijo no aparece en los datos de la familia, o la contraseña no funciona, o la aplicación da problemas: dejar aviso a la secretaría con el nombre del estudiante y qué ocurre (la Coordinación de Inglés lo resuelve con Amco). No prometer soluciones de la plataforma de Amco.$faq$
where name = 'Centro Educativo Gran Manantial de Sabiduría'
  and coalesce(faq_document, '') not like '%EXÁMENES DE INGLÉS EN LA PLATAFORMA EXCELLENT%';
