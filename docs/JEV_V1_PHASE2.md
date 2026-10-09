# JEV v1 — Fase 2: Marca, fuente y plan de salida

## Objetivo
Añadir una segunda capa previa al análisis económico para distinguir:
1. Riesgo de política de marca.
2. Calidad y trazabilidad de la fuente de compra.
3. Capacidad real de salir de la operación si algo cambia antes de vender.

Esta fase NO crea Market Score, Risk Score ni JEV Score final.

## Principio
No buscamos riesgo cero. Buscamos identificar riesgos estructurales y reducir exposición cuando el riesgo es tolerable.

`No encontré una prohibición` NO significa `la marca me autorizó`.

## A. Política de marca
### Datos
- Estado de política de marca.
- Fuente/URL o nota de verificación.
- Fecha de revisión.

### Estados
- AUTORIZACIÓN EXPLÍCITA
- SIN PROHIBICIÓN ENCONTRADA
- RESTRICCIÓN EXPLÍCITA AMAZON
- NO VERIFICADA

### Reglas
- RESTRICCIÓN EXPLÍCITA AMAZON → DESCARTAR.
- AUTORIZACIÓN EXPLÍCITA → señal fuerte positiva, pero no implica comprar por sí sola.
- SIN PROHIBICIÓN ENCONTRADA → permite continuar con advertencia; no convertir en autorización.
- NO VERIFICADA → permite análisis, pero debe quedar marcada como incertidumbre para Data Confidence y puede reducir el tamaño del piloto más adelante.

No usar `NO VERIFICADA → DESCARTAR` de forma automática.

## B. Verificación de fuente / supply chain
### Datos
- Tipo de fuente:
  - MARCA DIRECTA
  - DISTRIBUIDOR
  - RETAILER
  - OTRO
- Nombre del proveedor/retailer.
- URL o referencia de compra.
- Estado de autenticidad/trazabilidad:
  - VERIFICADA
  - RAZONABLE
  - DUDOSA
  - NO VERIFICADA
- Tipo de documento disponible:
  - FACTURA COMERCIAL
  - RECIBO RETAIL
  - ORDEN / COMPROBANTE
  - OTRO
  - NINGUNO

### Reglas
- DUDOSA → ESPERAR; no comprar hasta aclarar autenticidad/origen.
- NO VERIFICADA → advertencia fuerte; no confundir retailer conocido con documentación aceptada por Amazon.
- VERIFICADA / RAZONABLE → permite continuar.
- El sistema nunca debe afirmar que un recibo retail sirve para ungating o una reclamación de autenticidad sin evidencia específica.

## C. Match exacto producto ↔ ASIN
Registrar como control explícito:
- MATCH CONFIRMADO
- MATCH DUDOSO
- NO COINCIDE
- NO VERIFICADO

Validar cuando sea posible:
- UPC/EAN
- marca
- modelo
- tamaño
- variante
- pack/cantidad

### Reglas
- NO COINCIDE → DESCARTAR ese match/ASIN.
- MATCH DUDOSO / NO VERIFICADO → ESPERAR antes de comprar.
- MATCH CONFIRMADO → permite continuar.

## D. Plan de salida con proveedor/retailer
### Datos
- ¿Permite devolución?: SÍ / NO / NO VERIFICADO.
- Ventana de devolución en días.
- Restocking fee %.
- ¿Quién paga envío de retorno?: PROVEEDOR / NOSOTROS / NO APLICA / NO VERIFICADO.
- ¿Final sale?: SÍ / NO / NO VERIFICADO.
- Notas.

### Reglas
- No devolución / final sale NO es un hard gate por sí solo.
- Debe aumentar el riesgo y, más adelante, reducir el tamaño del piloto.
- Una devolución fácil es un mitigante, no una garantía de rentabilidad.

## E. Devoluciones Amazon — estructura preparada
Añadir placeholders, sin modelar todavía el costo financiero final:
- returnRateExpected
- resellablePct
- removalCostUnit
- prepReturnCostUnit
- resendCostUnit

Estos campos se utilizarán en la fase financiera/riesgo para diferenciar:
- unidad revendible;
- unidad dañada/no vendible;
- removal a Prep Center;
- reenvío a Amazon;
- pérdida total o parcial.

## Prioridad de puertas
1. Elegibilidad Amazon.
2. Match exacto producto/ASIN.
3. Restricción explícita de marca.
4. Autenticidad/origen dudoso.
5. Resto de señales = advertencias / riesgo, no veto automático.

## UX
Añadir debajo de Elegibilidad dos bloques compactos y plegables:
- `Marca y fuente`
- `Plan de salida`

La pantalla principal debe seguir siendo comprensible en móvil.

Resumen visible esperado:

```text
PRE-CHECK
Elegibilidad       AUTORIZADO
Match ASIN          CONFIRMADO
Marca               SIN PROHIBICIÓN ENCONTRADA
Fuente              RETAILER · RAZONABLE
Plan de salida      30 días · sin restocking

Resultado previo    PUEDE CONTINUAR
```

Ejemplo con bloqueo:

```text
Elegibilidad       AUTORIZADO
Match ASIN          CONFIRMADO
Marca               RESTRICCIÓN EXPLÍCITA AMAZON

Resultado previo    DESCARTAR
Motivo              La marca prohíbe explícitamente la venta en Amazon.
```

## Persistencia
Extender `jev_v1` sin romper datos de Fase 1.

Estructura orientativa:

```js
verification: {
  productMatch: {
    status: "NO VERIFICADO",
    checkedAt: null,
    note: ""
  },
  brandPolicy: {
    status: "NO VERIFICADA",
    source: "",
    checkedAt: null
  },
  supply: {
    type: "RETAILER",
    supplierName: "",
    purchaseUrl: "",
    authenticity: "NO VERIFICADA",
    documentType: "RECIBO RETAIL"
  },
  exitPlan: {
    returnAllowed: "NO VERIFICADO",
    returnWindowDays: null,
    restockingFeePct: 0,
    returnShippingPaidBy: "NO VERIFICADO",
    finalSale: "NO VERIFICADO",
    notes: ""
  }
},
returns: {
  returnRateExpected: null,
  resellablePct: null,
  removalCostUnit: null,
  prepReturnCostUnit: null,
  resendCostUnit: null
}
```

## Criterios de aceptación
1. Fase 1 sigue funcionando sin pérdida de datos.
2. Se puede registrar política de marca sin equiparar `sin prohibición encontrada` a autorización.
3. Se puede registrar tipo/calidad de fuente y documento disponible.
4. El match exacto del ASIN tiene estado propio.
5. NO COINCIDE bloquea ese match.
6. Restricción explícita de marca produce DESCARTAR.
7. Fuente DUDOSA produce ESPERAR.
8. No devolución/final sale solo genera advertencia, no descarte automático.
9. Quedan preparados los datos de devoluciones Amazon sin inventar cálculos todavía.
10. No se modifica `main`.
