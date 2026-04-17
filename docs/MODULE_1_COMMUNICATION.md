# Módulo 1: Estrategia de Comunicación Centro-Familia (WhatsApp)

Este módulo establece el canal de comunicación oficial del colegio, priorizando la agilidad, la formalidad y la validez legal de la información enviada.

## 1. El Canal Oficial (WhatsApp Evolution API)
WhatsApp es el canal de mayor penetración en familias. Para mantener el nivel institucional (estilo ToKApp):
- **Unidireccional**: Los envíos masivos no permiten respuestas abiertas (evita saturación).
- **Asistido**: El Bot Toki responde dudas frecuentes 24/7.
- **Certificado**: Cada aviso incluye un botón de confirmación que registra la lectura en nuestra base de datos.

---

## 2. Protocolos de Envío (SOP)

### A. Circulares Generales
- **Periodicidad**: Máximo 2 por semana (salvo urgencias).
- **Formato**: Texto breve + botón de confirmación + PDF adjunto si es necesario.
- **Horario**: Lunes a Viernes entre 9:30 AM y 11:30 AM (mayor tasa de apertura).

### B. Notificaciones de Ausencia
- **Disparador**: Registro de falta en Secretaría antes de las 10:00 AM.
- **Acción**: Envío automático al tutor legal.
- **Feedback**: El padre puede pulsar "Justificar" para enviar un motivo predefinido.

---

## 3. El Asistente Virtual "Toki"
Toki es el primer punto de contacto. Sus reglas de operación son:
1. **Identificación**: Siempre se presenta como el asistente oficial del centro.
2. **Escalado**: Si la duda es compleja (ej. "problema con un profesor"), Toki indica que se debe solicitar una tutoría presencial.
3. **Disponibilidad**: Los fines de semana solo atiende FAQs, no procesa bajas ni cambios administrativos.

---

## 4. Política de Reintentos (Auditoría de Lectura)
Para asegurar que la información llega (Competición con ToKApp/ParentSquare):
- **T+0h**: Envío inicial de la circular.
- **T+6h**: Si no hay registro de "Leído", el sistema envía un recordatorio: *"Hola [Nombre], recordamos que tiene una circular pendiente de confirmar."*
- **T+24h**: Si sigue sin lectura, se genera un reporte automático para el Tutor del grupo para seguimiento telefónico o personal.

---

## 5. Glosario de Estados (Database)
- **PENDING**: Pendiente de enviar por n8n.
- **SENT**: Entregado al dispositivo del padre (WhatsApp Double Check).
- **DELIVERED**: Notificación enviada pero no confirmada.
- **READ/CONFIRMED**: El padre pulsó el botón de confirmación. Este estado tiene validez legal interna.
