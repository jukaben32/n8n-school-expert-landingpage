# Plan del Módulo de Nómina — MentoriApp

> **Estado:** solo planificación. No hay código escrito.
> **Fecha:** 29 de septiembre de 2026.
> **País:** República Dominicana. Aplica a cualquier colegio de la plataforma (multi-colegio).

---

## 1. Resumen ejecutivo

El módulo de Nómina calculará lo que cobra cada empleado del colegio y lo que cuesta al colegio. También
preparará los archivos y reportes que el colegio presenta ante la TSS, la DGII y el Ministerio de Trabajo.

**Tres principios de diseño, no negociables:**

1. **Ninguna cifra legal va escrita en el código.** Tasas de la TSS, topes, escala del ISR y salarios
   mínimos van en una tabla de parámetros **con fecha de vigencia**. Hace falta ya: la **Ley 30-26**
   (promulgada el 18-jun-2026) cambia la escala del ISR a partir del **1 de enero de 2027**. La
   nómina de enero 2027 debe usar la escala nueva sin tocar código.
2. **Una nómina cerrada no se modifica.** Una vez aprobada queda congelada. Las correcciones se
   hacen con ajustes en la nómina siguiente, con rastro de quién y cuándo. Es lo que exige una
   auditoría de la TSS o la DGII.
3. **MentoriApp prepara; el colegio presenta.** La TSS y la DGII no tienen una API pública para
   presentar por terceros. El módulo genera el archivo de autodeterminación listo para subir al
   SUIRPlus y los datos para verificar el IR-3. La persona autorizada del colegio lo sube.

**Recomendación de arranque:** antes de construir, el colegio debe responder las preguntas de la
sección 4. Varias cambian el cálculo, por ejemplo si el colegio paga bonificación o si los docentes
cobran 10 o 12 meses.

---

## 2. Marco legal que cubre el módulo

| Norma | Qué obliga | Cómo lo cubre el módulo |
|---|---|---|
| **Código de Trabajo (Ley 16-92)** y su Reglamento 258-93 | Salario mínimo, jornada, horas extra, vacaciones, salario de Navidad, participación en beneficios, descuentos permitidos, preaviso y cesantía | Motor de cálculo, control de salario mínimo, módulo de vacaciones, regalía y liquidaciones |
| **Ley 87-01** (Sistema Dominicano de Seguridad Social) y **Ley 13-20** (fortalece la TSS) | Aportes a SFS, AFP (SVDS) y SRL; reporte mensual a la TSS; recargos por mora | Cálculo de aportes con topes; archivo de autodeterminación y novedades para el SUIRPlus |
| **Código Tributario (Ley 11-92)**, modificado por la **Ley 30-26** | Retención del ISR a asalariados, declaración mensual IR-3 y anual IR-13 | Retención mensual con escala por vigencia; resumen IR-3; reporte anual |
| **Ley 116-80 (INFOTEP)** | 1% de la nómina a cargo del empleador; 0.5% de la bonificación a cargo del trabajador | Aporte patronal automático; retención sobre bonificación si aplica |
| **Resolución CNS-01-2025** (Comité Nacional de Salarios) | Salario mínimo del sector privado no sectorizado según tamaño de empresa | Parámetro por colegio; alerta si un salario queda por debajo |
| **Ley 139-97** | Días feriados y su traslado | Calendario de feriados para horas extra y días trabajados |
| **Ministerio de Trabajo – SIRLA** | Planilla del Personal Fijo (DGT-3), a registrar en los primeros 15 días de operación y **renovar antes del 15 de enero** de cada año | Exportación con los datos de la planilla |
| **Ley 172-13** (protección de datos personales) | Confidencialidad de datos personales y salariales | Acceso restringido por rol, bitácora de accesos y conservación controlada |
| **Ley 66-97** (General de Educación) | Marco del personal docente | Sin cálculo propio; ver pregunta 4.3 sobre docentes |

---

## 3. Cifras vigentes (2026) — se guardarán como parámetros con fecha

### 3.1 Seguridad Social (TSS), vigente desde el 1-feb-2026

| Rubro | Empleado | Empleador | Tope mensual de salario cotizable |
|---|---|---|---|
| SFS (salud) | 3.04% | 7.09% | RD$232,230.00 (10 salarios mínimos) |
| AFP / SVDS (pensión) | 2.87% | 7.10% | RD$464,460.00 (20 salarios mínimos) |
| SRL (riesgos laborales) | — | 1.00% base + 0.1% a 0.3% según riesgo (**la tasa exacta del colegio sale en su factura de la TSS**) | RD$92,892.00 (4 salarios mínimos) |
| INFOTEP | 0.5% solo sobre bonificación | 1% de la nómina | — |

- **Salario mínimo cotizable** para los topes: **RD$23,223.00** (Resolución TSS 01-2025).
- **Pago a la TSS:** la factura (notificación de pago) se genera desde el día 20. Se paga **a más
  tardar el tercer día laborable del mes siguiente**. Después hay recargos e intereses.
- **Dependientes adicionales del SFS:** cuota fija por dependiente, descontada al empleado. Es un
  parámetro que cambia; se toma de la TSS.

### 3.2 Impuesto Sobre la Renta (DGII)

**Escala anual 2026.** Congelada desde 2018; la Ley 30-26 no la cambia para 2026.

| Renta neta anual | Impuesto |
|---|---|
| Hasta RD$416,220.00 | Exento |
| RD$416,220.01 – RD$624,329.00 | 15% del excedente de RD$416,220.01 |
| RD$624,329.01 – RD$867,123.00 | RD$31,216 + 20% del excedente de RD$624,329.01 |
| Más de RD$867,123.01 | RD$79,776 + 25% del excedente de RD$867,123.01 |

**Escala anual desde el 1-ene-2027** (Ley 30-26, art. 21, que modifica el art. 296 del Código Tributario):

| Renta neta anual | Impuesto |
|---|---|
| Hasta RD$480,000.00 | Exento |
| RD$480,000.01 – RD$685,000.00 | 15% del excedente de RD$480,000.01 |
| RD$685,000.01 – RD$910,000.00 | RD$30,750 + 20% del excedente de RD$685,000.01 |
| RD$910,000.01 – RD$4,800,000.00 | RD$75,750 + 25% del excedente de RD$910,000.01 |
| Más de RD$4,800,000.01 | RD$1,048,250 + 27% del excedente de RD$4,800,000.01 |

- **IR-3** (retenciones a asalariados): mensual, **a más tardar el día 10** del mes siguiente. La DGII
  lo alimenta con lo que el colegio reporta a la TSS en la autodeterminación (campos de salario ISR,
  otras remuneraciones, ingresos exentos, etc.). **Si el archivo de la TSS está bien, el IR-3 sale bien.**
- **IR-13:** declaración anual de retenciones a asalariados.
- **Exento del ISR:** salario de Navidad (regalía; la Ley 30-26, art. 33, lo ratifica) e
  indemnizaciones laborales (preaviso y cesantía).
- **Gravado:** salario ordinario, comisiones, horas extra, vacaciones, bonos e incentivos, bonificación.

### 3.3 Salario mínimo — sector privado no sectorizado (desde el 1-feb-2026)

| Tamaño de empresa | Salario mínimo mensual |
|---|---|
| Microempresa | RD$16,993.20 |
| Pequeña | RD$18,421.20 |
| Mediana | RD$27,489.60 |
| Grande | RD$29,988.00 |

> No encontramos un salario mínimo sectorial específico para centros educativos privados. Hay que
> confirmarlo con el asesor laboral del colegio (pregunta 4.1).

### 3.4 Reglas del Código de Trabajo que calcula el motor

| Concepto | Regla | Artículos |
|---|---|---|
| Salario diario | Salario mensual ÷ **23.83** | Práctica del Ministerio de Trabajo y los tribunales |
| Jornada | 8 horas diarias, 44 horas semanales | 147 |
| Horas extra | +35% sobre la hora normal hasta 68 horas semanales; +100% por encima | 203 |
| Jornada nocturna | +15% | 204 |
| Vacaciones | 14 días laborables tras 1 año; **18 días** tras 5 años; proporcionales si hay menos de 1 año | 177, 180 |
| Salario de Navidad (regalía) | 1/12 del salario ordinario devengado en el año; se paga a más tardar el **20 de diciembre**; tope de 5 salarios mínimos; proporcional al salir | 219 a 222 |
| Participación en beneficios (bonificación) | 10% de las utilidades netas; tope de 45 días de salario (menos de 3 años) o 60 días (3 años o más) | 223 a 227 |
| Preaviso | 3–6 meses: 7 días · 6–12 meses: 14 días · más de 1 año: 28 días | 76 |
| Auxilio de cesantía | 3–6 meses: 6 días · 6–12 meses: 13 días · 1–5 años: 21 días por año · más de 5 años: 23 días por año | 80 |
| Descuentos permitidos | Solo los autorizados por ley: ISR, TSS, cuota sindical, pensión alimenticia, anticipos y préstamos autorizados, etc. | 201 |
| Licencias pagadas | Matrimonio 5 días, fallecimiento de familiar 3 días, nacimiento de hijo 2 días | 54 |
| Maternidad | 14 semanas; subsidio del SFS gestionado vía SISALRIL | 236 |

> Las filas de este bloque que no vienen de una fuente oficial consultada directamente se marcan
> "a validar" en la sección 10. Todas deben confirmarse con el contador o abogado laboral antes de ir
> a producción.

---

## 4. Decisiones que debe tomar el colegio (antes de construir)

Cada una cambia el cálculo. Sin estas respuestas el módulo podría calcular mal.

1. **Tamaño de empresa** del colegio (micro, pequeña, mediana o grande) para el salario mínimo, y
   confirmación de que no aplica un salario mínimo sectorial.
2. **¿El colegio es sociedad comercial (SRL/SA) o asociación sin fines de lucro (ASFL)?** Las ASFL
   generalmente no reparten bonificación (art. 223). Define si el módulo calcula bonificación.
3. **Docentes en julio:** ¿cobran 12 meses, o el contrato cubre solo el año escolar? Es un punto
   legal delicado: un contrato por tiempo indefinido no deja de pagarse en vacaciones escolares.
   **Debe decidirlo el abogado laboral.** El módulo soportará las dos modalidades, pero no decidirá.
4. **Frecuencia de pago:** quincenal o mensual. Si es quincenal, ¿se retiene el ISR mitad y mitad o
   todo en la segunda quincena?
5. **Tasa SRL** exacta del colegio (sale en su factura de la TSS).
6. **Docentes por hora o por honorarios** (por ejemplo, profesores de áreas especiales). Los
   profesionales independientes **no van en nómina**: se les retiene ISR por honorarios y se declaran
   en el IR-17, no en el IR-3. Hay que definir quién es empleado y quién es contratista.
7. **Préstamos y anticipos:** ¿el colegio los da? ¿Cuánto se puede descontar por nómina?
8. **Seguro complementario o dependientes adicionales** que se descuentan al empleado.
9. **¿Quién prepara hoy la nómina?** (contador interno o externo). Esa persona debe validar los
   cálculos del módulo durante la marcha en paralelo (sección 8).
10. **Pago:** transferencia (¿qué banco?), cheque o efectivo. Define si más adelante se genera el
    archivo de pago para el banco.

---

## 5. Alcance

**Sí hace:**
- Ficha laboral del empleado: cédula, NSS, AFP, ARS, contrato, salario, cuenta bancaria, historial
  salarial.
- Cálculo de la nómina: salario, horas extra, ausencias, bonos, retenciones TSS e ISR, descuentos y
  aportes patronales.
- Cierre inmutable y volante de pago en PDF por empleado.
- Archivo de autodeterminación y de novedades para la TSS; resumen para verificar el IR-3.
- Vacaciones (saldo por empleado), regalía pascual y liquidación por salida (preaviso, cesantía,
  vacaciones y regalía proporcionales).
- Reportes: costo total del personal, costo por área o nivel, exportación a Excel.

**No hace (al menos en las primeras fases):**
- Presentar ante la TSS o la DGII por su cuenta (no hay API pública). El colegio sube los archivos.
- Pagar a los bancos automáticamente.
- Decidir temas legales como la pregunta 4.3. Los aplica una vez decididos.
- Contratistas por honorarios (IR-17). Se evaluaría como fase aparte.

---

## 6. Diseño técnico propuesto

### 6.1 Lo que ya existe y cómo se integra

- La tabla `staff` ya tiene nombre, correo, teléfono, puesto (`role`), `hire_date` y `exit_date`.
  **No tiene** cédula, salario ni datos de seguridad social.
- `staff_registrations` (autorregistro por WhatsApp) sí captura `national_id` (cédula).
- La lectura de `staff` ya está restringida a dirección y administración (migración `20260709000000`).
- Roles de acceso en `web/src/lib/permissions.ts`; cada módulo nuevo se agrega ahí **y** en
  `Sidebar.tsx` (trampa conocida del repo: se desincronizan).

**Decisión:** los datos laborales y salariales **no** se agregan a `staff`. Van en tablas nuevas con
su propia RLS, más estricta. Así un permiso de "Personal" nunca da acceso a salarios por accidente.

### 6.2 Tablas nuevas

| Tabla | Para qué |
|---|---|
| `legal_parameters` | **Nacional, no por colegio.** Tasas y topes de la TSS, salario mínimo cotizable, escala del ISR, salarios mínimos por tamaño. Cada fila tiene `valid_from` / `valid_to`. Solo la edita el super_admin. |
| `payroll_settings` | Por colegio: tamaño de empresa, tasa SRL, frecuencia de pago, si aplica bonificación, política de docentes en julio, cuenta de pago. |
| `employee_contracts` | Por empleado (1 a 1 con `staff`): cédula, NSS, AFP, ARS, tipo de contrato, jornada, salario vigente, cuenta bancaria, dependientes adicionales. |
| `salary_history` | Cada cambio de salario con fecha efectiva y motivo. Nunca se sobrescribe. |
| `payroll_concepts` | Catálogo de ingresos y descuentos, con banderas: ¿cotiza TSS?, ¿grava ISR?, ¿entra en regalía?, ¿entra en INFOTEP? |
| `payroll_periods` | Periodo (quincena o mes), estado: `borrador` → `calculada` → `aprobada` → `cerrada`. |
| `payroll_novelties` | Novedades del periodo: horas extra, ausencias, licencias, bonos, anticipos. |
| `payroll_lines` | Resultado por empleado y concepto (monto, base, tasa usada). **Inmutable al cerrar.** |
| `employee_loans` | Préstamos y anticipos con su plan de descuento. |
| `vacation_ledger` | Días ganados y tomados por empleado. |
| `terminations` | Salidas: causa, fecha, cálculo de prestaciones y derechos adquiridos. |
| `payroll_audit_log` | Quién calculó, aprobó, cerró, exportó o vio cada nómina. |

### 6.3 Motor de cálculo

Una sola función de cálculo, **pura** (recibe datos y parámetros, devuelve resultados, no consulta
nada). Es la misma lección de `installment_schedule` en Tesorería: la regla vive en un solo lugar.

Orden de cálculo para cada empleado:

1. Salario del periodo + novedades gravadas (horas extra, bonos, vacaciones).
2. **TSS del empleado:** SFS 3.04% y AFP 2.87% sobre el salario cotizable, **cada uno con su tope**.
3. **Base del ISR** = ingresos gravados − TSS del empleado.
4. **ISR:** anualizar (× 12), aplicar la escala **vigente en la fecha de pago**, dividir entre 12.
5. Otros descuentos permitidos (préstamos, dependientes adicionales, etc.), sin pasar los límites legales.
6. **Neto a pagar.**
7. **Costo del empleador:** SFS 7.09%, AFP 7.10%, SRL (tasa del colegio), INFOTEP 1%.
8. **Control:** alerta si el salario queda por debajo del mínimo aplicable.

**Ejemplo con cifras de 2026:** docente con salario mensual de RD$40,000, SRL de 1.10% (supuesto).

| Concepto | Monto (RD$) |
|---|---|
| Salario bruto | 40,000.00 |
| AFP empleado (2.87%) | −1,148.00 |
| SFS empleado (3.04%) | −1,216.00 |
| Base del ISR mensual | 37,636.00 |
| Base anual (× 12) | 451,632.00 |
| ISR anual: 15% × (451,632.00 − 416,220.01) | 5,311.80 |
| ISR mensual (÷ 12) | −442.65 |
| **Neto a pagar** | **37,193.35** |
| SFS empleador (7.09%) | 2,836.00 |
| AFP empleador (7.10%) | 2,840.00 |
| SRL (1.10%) | 440.00 |
| INFOTEP (1%) | 400.00 |
| **Costo total para el colegio** | **46,516.00** |

Con la escala de 2027, esa misma docente quedaría **exenta** de ISR: su base anual, RD$451,632, es
menor que RD$480,000. El motor lo aplicará solo, a partir de la nómina de enero.

### 6.4 Salidas

- **Volante de pago** (PDF) por empleado y periodo.
- **Archivo de autodeterminación mensual** para el SUIRPlus, siguiendo el instructivo oficial de la
  TSS. Hay que descargar la versión vigente del instructivo al construir; su formato cambia.
- **Novedades para la TSS:** ingreso, salida y cambio de salario.
- **Resumen IR-3** para comparar con lo que muestra la DGII.
- **Planilla de personal fijo** (datos para el DGT-3 en SIRLA, renovación antes del 15 de enero).
- **Reporte de costo** por periodo, área y nivel; exportación a Excel.
- **Constancia o carta de trabajo** con salario (a pedido del empleado).

### 6.5 Seguridad y privacidad (Ley 172-13)

- Módulo nuevo `nomina` en `permissions.ts`: acceso solo para `school_admin` y `director`. Si
  `finance` entra o no, lo decide el colegio.
- RLS en todas las tablas nuevas, filtrando por `school_id` y rol. **Nunca** usar el cliente admin
  sin repetir la autorización en código (trampa conocida del repo).
- Cada empleado verá **solo sus propios** volantes (fase 5, portal del personal).
- Toda consulta, cierre y exportación queda en `payroll_audit_log`.
- Cédulas y cuentas bancarias: mostrar enmascaradas, completas solo para quien las necesita.
- Conservación: **10 años** (plazo de prescripción tributaria). Nada se borra físicamente.
- Agregar comprobaciones del módulo a `npm run smoke`.

---

## 7. Fases de implementación

| Fase | Contenido | Resultado para el colegio |
|---|---|---|
| **0. Preparación** | Respuestas de la sección 4; recopilar cédula, NSS, AFP, ARS, salario y fecha de ingreso de cada empleado; conseguir 2 o 3 nóminas reales recientes | Datos listos y reglas definidas |
| **1. Base** | Tablas, parámetros legales, ficha laboral, motor de cálculo con pruebas automáticas | Calculadora exacta; aún no se cierra nómina |
| **2. Nómina** | Periodos, novedades, cálculo, aprobación, cierre inmutable, volantes, reporte de costo | Nómina mensual o quincenal completa |
| **3. Cumplimiento** | Archivo TSS, novedades, resumen IR-3, planilla DGT-3 | Archivos listos para subir |
| **4. Eventos del año** | Vacaciones, regalía pascual, préstamos, liquidaciones | Ciclo anual completo |
| **5. Extras** | Portal del empleado, archivo de pago al banco, exportación contable (Alegra) | Menos trabajo manual |

**Calendario sugerido:** la Fase 3 debería estar lista **antes de la nómina de enero 2027**, cuando
entra la escala nueva del ISR. La regalía (Fase 4) debería estar lista **antes del 20 de diciembre**,
o hacerse ese año por fuera del sistema.

---

## 8. Cómo se garantiza que calcula bien

1. **Pruebas automáticas del motor** con casos fijos: salarios en cada tramo del ISR, salarios sobre
   cada tope de la TSS, horas extra, entrada y salida a mitad de mes, regalía proporcional,
   liquidaciones y el cambio de escala 2026 → 2027.
2. **Contraste con los resultados oficiales:** la factura de la TSS y el IR-3 que muestra la DGII
   deben coincidir con el cálculo del módulo.
3. **Marcha en paralelo de 2 meses:** el colegio sigue haciendo su nómina como hoy, y el módulo
   calcula a la vez. Se compara empleado por empleado. Solo se pasa a producción si las cifras
   coinciden al centavo o cada diferencia está explicada.
4. **Firma del contador o asesor laboral** del colegio antes de usar el módulo para pagar.

---

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Cambian tasas, topes o escalas | Parámetros con fecha; el super_admin los actualiza sin tocar código |
| Formato del archivo de la TSS cambia | Generador aislado en un solo archivo; validar con el instructivo vigente |
| Decisión legal equivocada (docentes en julio, contratistas vs empleados) | La toma el abogado del colegio; el módulo solo la aplica |
| Fuga de datos salariales | RLS estricta, módulo separado de "Personal", bitácora |
| Corregir una nómina ya pagada | Cierre inmutable + ajustes en el periodo siguiente |
| Error de cálculo en producción | Marcha en paralelo + firma del contador |

---

## 10. Datos a validar con el contador o abogado laboral

Los confirmamos con fuentes secundarias fiables (Alegra, Siempre al Día, medios), pero no con el
texto oficial:

- Tope de la regalía en 5 salarios mínimos (art. 219) y cuál salario mínimo aplica al colegio.
- Si la regalía está exenta de aportes a la TSS, además del ISR.
- Recaudo del INFOTEP vía TSS y tratamiento del 0.5% sobre la bonificación.
- Flujo del subsidio de maternidad y enfermedad (SISALRIL): quién paga y cómo se reembolsa.
- Plazo exacto del IR-3 (día 10 del mes siguiente) y recargos vigentes tras la Ley 30-26.
- Formularios SIRLA adicionales al DGT-3 (cambios de personal, horarios, horas extra) que
  apliquen al colegio.
- Si existe salario mínimo sectorial para centros educativos privados.

---

## 11. Fuentes consultadas

- TSS — [Nuevos topes de cotización del Régimen Contributivo](https://tss.gob.do/tss-informa-nuevos-topes-de-cotizacion-del-regimen-contributivo-del-sdss/)
- TSS — [Preguntas frecuentes](https://tss.gob.do/preguntas-frecuentes/)
- TSS — [Instructivo de archivos de autodeterminación y novedades](https://www.tss.gob.do/assets/inst_const_autodeternov_0321_v5.pdf) (enlace caído al consultarlo; descargar la versión vigente desde el SUIRPlus)
- DGII — [Tabla de retenciones](https://dgii.gov.do/publicacionesOficiales/tablaRetenciones/Paginas/default.aspx) y [Guía del contribuyente No. 11](https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/retencionesRetribucionesComplementarias/Documents/2-Guia-11-Retenciones%20del%20Impuesto%20Sobre%20la%20Renta.pdf)
- Presidencia — [Ley 30-26](https://presidencia.gob.do/leyes/ley-30-26)
- Siempre al Día — [Tabla de retención del ISR 2026 y Ley 30-26](https://siemprealdia.co/republica-dominicana/impuestos/tabla-de-retencion-del-isr/)
- Revista Mercado — [Principales medidas de la Ley 30-26](https://revistamercado.do/money-invest/daily-news/abinader-promulga-la-reforma-fiscal-estas-son-las-principales-medidas-de-la-ley-30-26/)
- Alegra — [Retenciones ISR de nómina 2026](https://blog.alegra.com/republica-dominicana/retenciones-isr-de-nomina/) y [Salario mínimo en RD](https://blog.alegra.com/republica-dominicana/salario-minimo-en-rd/)
- EY — [Salario mínimo 2026](https://www.ey.com/es_ce/technical/tax/tax-alerts/republica-dominicana-salario-minimo-2026)
- Ministerio de Trabajo — [Código de Trabajo (PDF)](https://mt.gob.do/wp-content/uploads/2024/07/codigo_de_trabajo.pdf) y [Planilla del personal fijo (SIRLA)](https://transparencia.mt.gob.do/index.php/servicios/servicio-no-1)
- CNSS — [Reglamento sobre el Seguro de Riesgos Laborales](https://cnss.gob.do/wp-content/uploads/2025/01/Reglamento-Sobre-el-Seguro-de-RL-v2.pdf)
