# Tesorería necesita emisión de e-CF nativa — no depender de Alegra

**Estado al 2026-09-21:** hallazgo de una auditoría de código del módulo de
Tesorería, hecha al evaluar si su lógica servía de base para un proyecto
aparte. No es un incidente activo — hoy el único colegio afiliado (Gran
Manantial de Sabiduría) sí tiene Alegra — pero define una dirección de
producto que conviene fijar antes de afiliar a un segundo colegio.

**Objetivo de este documento:** Tesorería debe poder emitir e-CF reales por
sí misma, sin que el colegio necesite tener Alegra (ni ningún otro sistema
contable externo). La implementación NO está pensada para seguir dependiendo
de Alegra hacia adelante.

---

## El problema, con evidencia concreta

`generate_ncf()` (definida en `supabase/migrations/20260702200000_payments.sql`,
endurecida en `20260910010000_reception_treasury_rls_and_ncf_hardening.sql`)
**no emite un e-CF real.** Solo arma un string secuencial con este formato:

```
v_ncf := v_prefix || lpad(v_sequence::text, 8, '0');   -- ej. B0200000001
```

Eso es un número con forma de NCF, nada más. No genera XML, no firma
digitalmente, no llama a ningún web service de la DGII, no produce el QR ni el
código de seguridad que exige un e-CF real.

**El único camino a un e-CF real que existe hoy en esta plataforma es a través
de Alegra**, y no lo emite esta plataforma: el colegio factura dentro de
Alegra (fuera de este sistema), y `alegraMatching.ts` +
`reconcileAlegraPayments.ts` solo **leen** esas facturas vía su API REST y las
concilian contra los registros internos de familias/estudiantes — nunca
generan un documento fiscal propio. Esto está documentado y es intencional
(ver `docs/ACTIVAR_CONCILIACION_ALEGRA.md`, sección "Dos cosas que conviene
saber": *"El e-CF real ya lo emitió Alegra y emitir otro aquí sería un
documento fantasma ante la DGII"*).

**En otras palabras:** hoy Tesorería es autosuficiente para *cobrar* (Azul,
transferencias con comprobante, cuentas por cobrar, recargos por mora), pero
**no es autosuficiente para *facturar fiscalmente*** — depende enteramente de
que el colegio tenga Alegra ya configurado.

## Por qué esto define una dirección de producto, no solo un parche

Si un colegio se afilia a MentoriApp sin Alegra, el flujo actual
**Tesorería → Facturar** (`web/src/app/dashboard/tesoreria/facturar/`) sigue
funcionando de cara al usuario — genera un "NCF" con `generate_ncf()` y lo
marca como factura — pero ese documento **no tiene ningún valor fiscal real
ante la DGII**, sin ningún aviso en la UI de que esto es así. El riesgo no es
técnico, es de cumplimiento: el colegio puede creer que está facturando en
regla cuando no lo está.

Por eso la solución correcta no es "agregar Alegra como opción para los
colegios que la tengan" (eso ya funciona hoy, para uno) — es que Tesorería
tenga su **propia capacidad de emitir e-CF**, para que cualquier colegio,
tenga o no un sistema contable externo, quede cubierto igual.

## Recomendación: emisión de e-CF nativa vía eCF MSeller

Existe otro proyecto en desarrollo (`ecf-saas-rd`, SaaS de facturación
electrónica DGII) que ya investigó a fondo un proveedor PSFE certificado
(**eCF MSeller** — API REST, modo multi-tenant, plan gratis hasta 250
comprobantes/mes) precisamente para emitir e-CF reales sin construir la
integración directa con la DGII desde cero (firma digital, schemas XML,
certificación PSFE propia — ver el razonamiento completo en
`ecf-saas-rd/DECISIONES.md`, "No Construir Integración Directa DGII desde
Cero").

La propuesta para Tesorería: reemplazar `generate_ncf()` por una emisión real
contra MSeller, usando las credenciales/certificado propios de cada colegio
(mismo modelo multi-tenant tipo "Proveedor" ya documentado en
`ecf-saas-rd/docs/MSELLER-API.md`). Esto se convierte en el camino estándar
de facturación para **todos** los colegios afiliados, no solo los que no
tengan Alegra.

Esto reutiliza directamente la investigación técnica ya hecha (endpoints,
autenticación, formato de documentos, tipos de comprobante) en vez de
duplicar ese trabajo dentro de este repositorio.

## Qué queda abierto (decisión del founder, no de este documento)

Este documento no decide qué pasa con la integración de Alegra que ya
funciona hoy para Gran Manantial de Sabiduría — si se conserva solo para ese
colegio, se retira una vez que la emisión nativa esté lista, o convive un
tiempo mientras se migra. Eso es una decisión de producto a tomar aparte,
no algo que este hallazgo deba resolver por sí mismo.

## Qué NO hacer

- No presentar `generate_ncf()` como si fuera un e-CF real en ningún flujo
  nuevo — hoy solo es "seguro" porque el único colegio siempre pasa por
  Alegra por fuera de este sistema.
- No construir firma digital, generación de XML ni integración directa con la
  DGII dentro de este repositorio — esa complejidad ya se evaluó y se decidió
  evitarla construyendo sobre un PSFE certificado en su lugar.

## Próximos pasos

- [ ] Confirmar si hay un segundo colegio en conversación — eso convierte
      esto de "dirección de producto" en bloqueante real con fecha
- [ ] Diseñar la integración nativa de Tesorería con eCF MSeller, basada en
      `ecf-saas-rd/docs/MSELLER-API.md`
- [ ] Mientras tanto, considerar un aviso claro en el flujo de "Facturar"
      indicando que el documento generado no es un e-CF fiscal válido, hasta
      que la emisión nativa esté lista

---

**Referencia cruzada:** `ecf-saas-rd/docs/MSELLER-API.md` (documentación
técnica de MSeller ya investigada) y `ecf-saas-rd/DECISIONES.md` (por qué se
eligió construir sobre un PSFE en vez de integración directa con la DGII).
