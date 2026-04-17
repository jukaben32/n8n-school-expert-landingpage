# Diseño Operativo de la Base de Datos (Fase 1)

Para que el colegio funcione de manera fluida, la base de datos debe ser la "única fuente de la verdad". Organizaremos los datos en las siguientes tablas (entidades).

## 1. Tabla: FAMILIAS (`familias`)
Representa el contacto legal y financiero del centro.
- `id_familia`: PK (Único).
- `tutor_1_nombre`: Nombre completo del contacto principal.
- `tutor_1_telefono`: Número para WhatsApp (Evolution API).
- `tutor_1_email`: Para documentos largos o copias de seguridad.
- `idioma_preferente`: Esp/Eng (Para notificaciones multi-idioma).
- `consentimiento_gdpr`: Booleano (Sí/No).
- `whatsapp_status`: Activo/Inactivo.

## 2. Tabla: ALUMNOS (`alumnos`)
- `id_alumno`: PK (Único).
- `id_familia`: FK (Relaciona al alumno con sus padres).
- `nombre`: Nombre del alumno.
- `apellidos`: Apellidos.
- `curso`: (Ej: 1° Primaria).
- `clase`: (Ej: A, B, C).
- `observaciones_medicas`: (Alergias, etc.).

## 3. Tabla: COMUNICACIONES (`comunicaciones`)
Para el seguimiento de lo que se envía (Validez Legal).
- `id_notificacion`: PK.
- `id_familia`: FK (A quién se envió).
- `id_alumno`: FK (Opcional, si el mensaje es individual).
- `tipo`: Urgente / Académico / Administrativo.
- `contenido`: Texto del mensaje enviado.
- `fecha_envío`: Timestamp automático.
- `fecha_lectura`: Timestamp (Se llena cuando pulsan "Confirmar").
- `status`: Enviado / Error / Leído.

## 4. Tabla: PAGOS (`pagos`)
- `id_pago`: PK.
- `id_alumno`: FK.
- `concepto`: (Ej: Mensualidad Octubre).
- `monto`: Valor en euros.
- `estado`: Pendiente / Pagado / Cancelado.
- `stripe_url`: Enlace generado para el pago.

---

## 🔗 Relaciones Educativas
- Una **Familia** puede tener varios **Alumnos**.
- Una **Notificación** puede enviarse a una **Familia** o a una **Clase** entera (Broadcasting).
- Las **Asistencias** (Fase 2) se vincularán al **Alumno** y dispararán una **Notificación** a la **Familia**.
