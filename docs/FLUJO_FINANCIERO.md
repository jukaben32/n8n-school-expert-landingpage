# Módulo 2: Estrategia de Gestión Financiera y Cobros Híbridos

Este módulo automatiza la recaudación de fondos del centro escolar, adaptándose a la realidad bancaria de la **República Dominicana**, donde las transferencias directas son un pilar central.

## 💳 1. Canales de Pago Admitidos

### A. Pago Digital Seguro (Stripe)
Recomendado para familias que prefieren pagar con tarjeta de crédito desde su móvil.
- **Ventaja**: Conciliación 100% automática. El sistema marca el pago como realizado sin intervención humana.
- **Coste**: Comisión por transacción propia de Stripe.

### B. Transferencia Bancaria Directa (Banreservas, etc.)
El método más utilizado por su bajo coste operativo para las familias.
- **Proceso**: El padre recibe los datos de cuenta del colegio por WhatsApp y envía el **comprobante (foto)** por el mismo canal.
- **Auditoría**: Un encargado de finanzas (Contable) valida el comprobante en n8n antes de que el pago se dé por firme.

---

## 🏗️ 2. Ciclo Operativo de Cobro (SOP)

1. **Emisión de Recibos (Día 1 del Periodo)**:
   - n8n lanza el aviso de pago a las familias vía WhatsApp (Toki).
   - Se incluyen los botones de opción: **[Tarjeta/Stripe]** o **[Ver Datos de Transferencia]**.
   
2. **Recepción y Validación**:
   - Si el padre paga por Stripe: El sistema actualiza `pagos` y envía factura PDF al instante.
   - Si el padre transfiere: Toki solicita la foto. Al recibirla, se genera una alerta específica para el departamento financiero.

3. **Gestión de Moras y Recargos (Educación Financiera)**:
   - Si el pago no ocurre antes de [Fecha Límite], el sistema comprueba el interruptor de `automatic_late_fees` en `configuracion_sistema.csv`.
   - Si está activo, el monto total se incrementa automáticamente (ej. +5%) antes del siguiente recordatorio.

---

## 📄 3. Automatización de Recibos y Facturas
Una vez confirmado el pago (por cualquier vía), el sistema:
1. Genera un **Recibo Digital** único corregido con el timbre del colegio.
2. Actualiza la tabla de pagos en tiempo real.
3. Lo envía por WhatsApp a la familia y lo almacena en una carpeta compartida (Google Drive/OneDrive) para contabilidad.

---

## ⚖️ 4. Validez y Seguridad
Todos los enlaces de Stripe están cifrados con TLS y los datos bancarios se envían de forma encriptada, protegiendo tanto al centro como a las familias.
