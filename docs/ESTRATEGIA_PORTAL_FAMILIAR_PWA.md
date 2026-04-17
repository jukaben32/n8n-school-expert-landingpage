# Estrategia: El Portal del Padre (Web-App / PWA)
## Centro Educativo Gran Manantial de Sabiduría

Esta estrategia define cómo los padres de familia accederán a la información detallada de sus hijos de manera segura, rápida y sin necesidad de instalar aplicaciones desde la App Store o Play Store.

---

## 📱 1. ¿Qué es una PWA (Progressive Web App)?
Una PWA es un sitio web diseñado para comportarse como una aplicación móvil. El padre solo tiene que pulsar "Añadir a la pantalla de inicio" desde su navegador para tener un icono de acceso directo junto a sus otras Apps.

**Ventajas**:
- **Cero fricción**: No requiere descarga ni espacio en el móvil.
- **Acceso Directo**: Aparece el icono del colegio en el escritorio del móvil.
- **Seguridad Dinámica**: Solo accesible a través del WhatsApp registrado.

---

## 🔐 2. Flujo de Acceso Seguro

1.  **Petición**: El padre escribe "Portal" al Bot **Toki** por WhatsApp.
2.  **Validación**: n8n verifica que el número de teléfono esté vinculado a un alumno activo.
3.  **Link Temporal**: n8n genera un enlace de un solo uso (Ej: `https://portal.colegio.com/auth?token=XYZ123`).
4.  **Entrada**: Al pulsar el link, se abre el Dashboard personalizado del alumno.

---

## 📊 3. ¿Qué verá el padre en su Portal?

El dashboard unificado mostrará:
- **Resumen Financiero**: Saldo pendiente, historial de pagos (con descarga de PDFs).
- **Asistencia Mensual**: Gráfico de barras de días presentes, faltas y retrasos.
- **Expediente Académico**: Notas del periodo y enlaces a boletines finales.
- **Calendario Escolar**: Próximas excursiones y eventos de aula.

---

## 🛠️ 4. Implementación Técnica en n8n
- **Generador de Enlaces**: El workflow `6.1_generador_link_padre_seguro.json` se encarga de crear el token y enviar el mensaje.
- **Backend**: Los datos se sirven desde el Google Sheet de métricas (`db/dashboard_kpis_template.csv`) filtrando únicamente por el ID del alumno correspondiente.
