# Protocolo de Control de Asistencia para Profesores

Para garantizar la seguridad de los alumnos y el cumplimiento de los reglamentos del centro, el pase de lista es un procedimiento obligatorio y diario.

## 🕒 Horario y Frecuencia
- **Pase de Lista Inicial**: Todos los días lectivos a las **9:00 AM**.
- **Cierre del Registro**: El profesor debe terminar el registro antes de las **9:15 AM**, momento en el que se disparan las alertas automáticas a las familias.

---

## 🛠️ Procedimiento en Google Sheets
Cada profesor tiene acceso a la hoja de cálculo de su curso (Ej: "1-Primaria-A"). 

1. **Localice al Alumno**: Busque el nombre en la lista vertical.
2. **Localice la Fecha**: Busque el día actual en la fila horizontal.
3. **Marque el Estado**:
   - Deje la celda **VACÍA** si el alumno está **PRESENTE**.
   - Coloque una **"A"** si el alumno está **AUSENTE**.
   - Coloque una **"L"** (Late) si el alumno llega **RETRASADO** (después de las 9:10 AM).

---

## 📡 Automatización y Alertas
- **A las 9:15 AM**: El sistema n8n leerá las celdas marcadas con "A" y enviará el aviso a los padres vía WhatsApp (Toki).
- **Justificaciones**: Si el padre justifica por mensaje, la celda cambiará automáticamente a "J" (Justificado) en tu hoja de Google Sheets. No necesitas cambiarlo tú.

---

## ⚠️ Casos Especiales
- **Salida Anticipada**: Si el padre viene a recoger al alumno antes de las 4:00 PM, deberá informar a Secretaría para que actualicen el registro en el sistema.
- **Error en el Marcado**: Si marcaste a alguien como ausente y llega a las 9:30 AM, cámbialo a "L" inmediatamente para evitar la acumulación de avisos por error.

---
> [!IMPORTANT]
> **Regla de 3**: Si un alumno acumula más de **3 marcas de "L" (Retraso)** en un mes, el sistema alertará automáticamente a la familia y al Tutor del curso para una reunión de seguimiento.
