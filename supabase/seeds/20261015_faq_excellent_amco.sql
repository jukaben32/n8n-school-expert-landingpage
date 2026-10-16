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
- El examen YA ESTÁ DISPONIBLE: está vigente desde hoy (16 de octubre de 2026) hasta el 30 de noviembre de 2026. Después de esa fecha ya no podrán tomarlo.
- Reglas importantes del examen: (1) Una vez que el estudiante lo inicia, debe completarlo. Si lo cierra sin terminar, el sistema de Amco asume que finalizó y no le permite volver a tomarlo. (2) Por eso hay que disponer de tiempo al sentarse a hacerlo: es un examen extenso. (3) Los niños necesitarán el apoyo de los padres para lograrlo. Si el padre pregunta si puede retomarlo después de cerrarlo, decir que no: Amco lo da por finalizado; no prometer que el colegio pueda reabrirlo. Cerrar siempre con un mensaje de ánimo: ¡Muchos éxitos en la realización del mismo!
- Si el correo de Amco de un hijo no aparece en los datos de la familia, o la contraseña no funciona, o la aplicación da problemas: dejar aviso a la secretaría con el nombre del estudiante y qué ocurre (la Coordinación de Inglés lo resuelve con Amco). No prometer soluciones de la plataforma de Amco.$faq$
where name = 'Centro Educativo Gran Manantial de Sabiduría'
  and coalesce(faq_document, '') not like '%EXÁMENES DE INGLÉS EN LA PLATAFORMA EXCELLENT%';
