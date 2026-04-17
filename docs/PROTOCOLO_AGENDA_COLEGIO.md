# Protocolo de Agenda Digital y Comunicación con Familias

Este documento define cómo el profesorado debe alimentar el sistema de comunicación diaria para mantener a las familias informadas sobre la vida escolar de sus hijos.

## 📅 1. Frecuencia de Comunicación

### A. El "Viernes de Noticias" (General)
- **Periodicidad**: Semanal (Cada Viernes a las 3:30 PM).
- **Contenido**: Un resumen de los logros del grupo, temas aprendidos y recordatorios para la semana siguiente.
- **Objetivo**: Mantener a la familia conectada sin generar saturación.

### B. El "Seguimiento Diario" (Especial)
- **Activación**: Solo para alumnos específicos marcados en la base de datos con `seguimiento_diario = TRUE`.
- **Contenido**: Registro de alimentación, siestas (infantil) o comportamiento específico.
- **Objetivo**: Proporcionar apoyo extra a familias que lo necesitan por recomendación del tutor o dirección.

---

## 🥗 2. Gestión del Comedor
- **Publicación del Menú**: Se realiza automáticamente cada Lunes a las 8:30 AM.
- **Incidencias**: Si un alumno no come adecuadamente o presenta una reacción, el profesor debe informarlo en la columna "Incidencia_Comedor" del Sheet para un aviso inmediato.

---

## 📝 3. Las "Notas Rápidas" de Padres
El sistema permite que el padre envíe un mensaje corto antes de las 8:45 AM (Ej: *"Hoy no ha dormido bien, puede estar irritable"*).
- **Recepción**: Los profesores recibirán un aviso consolidado en su panel antes de empezar la clase.
- **Uso**: Estas notas son informativas; no requieren respuesta obligatoria del profesor salvo que sea una urgencia médica.

---

## 🎭 4. Autorización de Eventos (Botones)
Para cada excursión o evento especial:
- El profesor solicita la creación del evento en el sistema.
- **n8n** envía el mensaje interactivo.
- Al pulsar **[SÍ]**, el sistema genera el **PDF de Autorización** en el expediente del alumno automáticamente.
