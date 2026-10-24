# Puente Scanner → Calculador · contrato JSON v2.3

**Estado:** rama `feature/scanner-json-v23-bridge` (sobre `feature/tema-scanner`). Sin fusionar.
**Fuente de verdad del formato:** `app/export/json_export.py` del Scanner (`338f6e8`).
**Fixture de prueba:** `tests/fixtures/scanner-v23-export-real-3.json`, generado por el exportador real del Scanner con Amazon simulado (ASIN `B0FAKE…`, datos ficticios).

## 1. Qué hace y qué no

| Hace | No hace |
|---|---|
| Lee el JSON v2.3 del Scanner (1 o varios prospectos) y el formato antiguo v1 | No compra, no registra compras, no publica, no toca operaciones, capital ni gastos |
| Valida todo y muestra una **vista previa** sin escribir nada | No reemplaza el producto activo |
| Agrega los seleccionados al catálogo local como **CANDIDATOS** | No carga costos de la tienda como costos reales |
| Guarda la evidencia del Scanner con sus **fechas originales** | No inventa fechas, ventas, Buy Box, vendedores ni histórico |
| Separa **permiso para publicar** y **FBA** | No marca como verificado tu match, marca ni autenticidad |
| Aporta la evidencia FBA del Scanner a la puerta FBA obligatoria | No reemplaza una verificación manual más reciente |

## 2. Archivos

| Archivo | Cambio |
|---|---|
| `scanner-bridge.js` (nuevo) | Núcleo puro (validar → normalizar → planificar → escribir) + vista previa + tarjeta «Dato Scanner» |
| `data-tools.js` | El botón ahora es «Importar prospectos del Scanner» y usa el puente. Se retiró el importador anterior (escribía 3 claves sin vista previa y fijaba fechas = ahora) |
| `fba-verification.js` (nuevo) | Regla FBA obligatoria + panel de registro manual |
| `jev-phase6-engine.js` | Puerta FBA en `gate()` (DESCARTAR primero, luego ESPERAR) + 8 autopruebas FBA |
| `jev-v1.js` | La tarjeta de elegibilidad muestra la fuente real (antes decía siempre «MANUAL») |
| `index.html`, `sw.js`, `jev-phase4-market.js` | Carga y caché del módulo nuevo (`scanner-bridge.js?v=1`, `data-tools.js?v=68`) |
| `server/jev-server.cjs` | `scanner-bridge.js` en la lista de archivos que sirve el servidor local |
| `tests/scanner-bridge.cjs`, `tests/run-all.cjs`, `tests/fixtures/…` | Pruebas nuevas |

## 3. Equivalencia de campos

| Scanner v2.3 | Calculador | Regla |
|---|---|---|
| `asin` | `product.asin` | Obligatorio, `^[A-Z0-9]{10}$` |
| `gtin` | `product.upcEan` | **Texto**; si viene como número se rechaza (perdería ceros) |
| `condition` | `product.condition` | Solo `NEW`; otro valor se rechaza |
| `listing_eligibility` | `eligibility.status` | AUTHORIZED→AUTORIZADO · REQUIRES_APPROVAL→REQUIERE APROBACIÓN · NOT_AUTHORIZED→NO AUTORIZADO · otro→NO VERIFICADO. `checkedAt=null`, `evidenceAt=exported_at`, `validUntil=expires_at`. Si ya lo fijaste a mano, no se pisa |
| `fulfillment_eligibility` | `fulfillment.status` (nuevo, separado) | FBA_ELIGIBLE / FBA_RESTRICTED / HAZMAT_REVIEW / NOT_VERIFIED; desconocido → NOT_VERIFIED |
| `amazon_sale_price_conservative` | `p_precio` | Precio de venta, nunca costo. Respaldo: `amazon_price` |
| `amazon_fees.referral` | `p_ref` (%) | `referral ÷ precio conservador × 100` (las comisiones se calcularon a ese precio) |
| `amazon_fees.fba + other` | `p_fba` | USD por unidad |
| `bsr_current` | `market.bsrCurrent` | Dato puntual; `market.checkedAt = last_checked` |
| — | `market.amazonSeller` | **NO VERIFICADO** (el v2.3 no lo trae) |
| `source_*`, `shipping_cost`, `source_tax*`, `source_acquisition_cost` | `scanner.*` (evidencia) | Se muestran; **no** se cargan en COGS ni flete |
| `net_profit_per_unit_estimate`, `logistics_assumed` | `scanner.*` | Ganancia **preliminar**; costes pendientes |
| `match_*`, `risk_flags`, `historical_*`, `manual_history_check`, `source_trust_level`, `status_reason` | `scanner.*` | Se muestran; no aprueban nada |
| `exported_at`, `last_checked`, `expires_at`, `amazon_fees.fetched_at` | `scanner.*` | Se conservan tal cual |
| `amazon_url` | `product.marketplace` | amazon.com→US, .ca→CA, .com.mx→MX; si falta, la vista previa pide elegirlo |

## 4. Puerta FBA del Motor Scoring (obligatoria para todos, aprobada 2026-10-22)

Vive en `fba-verification.js` y aplica a **todos** los productos: manuales, del Scanner o de Nepeto (que entra por el Scanner).

| Verificación FBA del producto | Decisión |
|---|---|
| Autorizado para tu cuenta, vigente y del **mismo ASIN, marketplace, condición y modalidad FBA** | Continúa al Motor Scoring |
| Sin verificar | ESPERAR |
| Requiere aprobación / revisión hazmat | ESPERAR |
| No autorizado | DESCARTAR |
| De otro ASIN, marketplace o condición, o modalidad distinta de FBA | ESPERAR (volver a verificar) |
| Vencida (72 h) o sin fecha de vigencia | ESPERAR |

- Registro manual: en «Identificación y elegibilidad» → **Verificación FBA (obligatoria)**, con nota obligatoria; se liga al ASIN, marketplace y condición actuales.
- Registro del Scanner: vale hasta `expires_at`. Una verificación manual más reciente no se pisa al reimportar.
- Solo cambia la decisión **actual**: operaciones y análisis guardados conservan su predicción. «Registrar compra» exige COMPRAR PILOTO, así que sin FBA vigente no se puede registrar una compra nueva.

## 5. Escritura y recuperación

- La vista previa no escribe nada.
- Importar escribe **una** clave: `motor_scoring_asin_v1`. Si un ASIN es el producto activo, además actualiza solo su evidencia en `jev_v1` y recarga.
- Si una escritura falla (cuota), se restaura lo que alcanzó a escribirse y se avisa «No se guardó nada». Con varias claves de `localStorage` no hay transacción real: el respaldo del navegador sigue siendo la red de seguridad.
- Reimportar el mismo archivo: «SIN CAMBIOS». Un ASIN que ya está en tu catálogo conserva su análisis, costos, verificación e inputs; solo cambia la evidencia del Scanner.

## 6. Uso

Scanner → Prospect Queue → **Exportar JSON** → Calculador → Resumen de compras → **Importar prospectos del Scanner** → vista previa → seleccionar → **Importar seleccionados** → **Abrir en el Calculador** → completar costos reales y verificaciones → Seller Central → decisión.

## 7. Vuelta atrás

1. Código: `git switch feature/tema-scanner` (o `feature/jev-v1`) y cerrar/abrir la Calculadora.
2. Datos: «Restaurar respaldo» con el JSON del respaldo previo. Los candidatos importados solo viven en `motor_scoring_asin_v1`; el resto de tus datos no cambia al importar.

## 8. Límites conocidos

- El v2.3 no trae marca, categoría, presencia de Amazon Retail ni fecha propia del chequeo FBA: quedan vacíos o NO VERIFICADO.
- La vigencia de FBA y del permiso usa `expires_at` del prospecto (≤ 72 h).
- La ganancia del Scanner usa logística supuesta (US$1,50) e impuesto supuesto: no reemplaza los costos del prep center.
- Pack/variante: el match EXACT del Scanner no sustituye tu verificación en «Marca y fuente».
