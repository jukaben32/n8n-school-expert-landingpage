# Módulo 4: Estrategia de Gestión de Secretaría y Expedientes Digitales

Este módulo transforma la secretaría del centro escolar en una unidad de alta eficiencia, eliminando el archivo físico y automatizando la validez legal de la documentación.

## 📁 1. Estructura de Almacenamiento (Google Drive)

El sistema genera automáticamente una jerarquía limpia para cada nuevo alumno en la nube:

`[Raíz] / Colegio_Digital / Expedientes / [Año_Ciclo] / [Nombre_Alumno]`

Cada carpeta de alumno contiene:
1.  **01_Personal**: DNI/Pasaporte, Acta de Nacimiento, Fotos.
2.  **02_Legal**: Contratos de Matrícula (Firmados Digitalmente).
3.  **03_Academico**: Boletines de notas y reportes de progreso.
4.  **04_Salud**: Carnet de vacunación y certificados médicos.

---

## ✒️ 2. Sistema de Firma Digital Legal

Para garantizar la seguridad jurídica del centro (Matrículas, SEPA, Autorizaciones), implementamos un sistema de **Firma Híbrida**:

1.  **Validación Interna (WhatsApp)**: El padre pulsa un botón de "Acepto" en Toki para trámites menores (Ej: Autorización de excursión). n8n registra el timestamp y el ID de dispositivo.
2.  **Firma Legal (Dropbox Sign / SignNow)**: Para el contrato de matrícula anual.
    -   n8n genera el documento.
    -   Lo envía por email para firma biométrica/digital.
    -   El documento firmado se auto-archiva en la carpeta `02_Legal` del alumno.

---

## 📄 3. Autoservicio de Certificados (On-Demand)

El colegio ofrece un servicio 24/7 a las familias:
- **Proceso**: El padre escribe al Bot: *"Necesito mi certificado de gastos"* o *"Certificado de estudio"*.
- **Ejecución**: n8n consulta la base de datos, genera el PDF con el sello digital del colegio y el código QR de verificación.
- **Suelo de Secretaría**: Las familias no necesitan ir físicamente al colegio ni llamar para pedir papeles básicos.

---

## 🔒 4. Seguridad y Privacidad (GDPR)

- **Acceso Restringido**: Solo el personal con rol de "Secretaría" o "Dirección" tendrá acceso a la carpeta raíz de `/Expedientes`.
- **Auditoría**: Cada acceso a los documentos deja rastro en los logs de Google Drive.
- **Limpieza**: Los expedientes de alumnos que abandonan el centro se mueven automáticamente a `/Expedientes/Archivo_Bajas` para conservar su historial legal por el tiempo establecido por ley.
