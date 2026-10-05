# JEV v1 — Fase 3: costo real, Prep Center y devoluciones

## Objetivo
Capturar el costo real antes de la venta y preparar el impacto de devoluciones sin reemplazar todavía la calculadora financiera heredada.

## A. Costo real antes de venta
Registrar:
- precio mostrado por unidad;
- descuento/cupón por unidad;
- impuesto por unidad;
- flete proveedor → Prep Center del lote;
- costo Prep Center por unidad;
- otros costos Prep del lote;
- flete Prep Center → Amazon del lote.

### Fórmulas
`checkoutUnit = max(0, displayedPrice - discountUnit + taxUnit)`

`landedUnit = checkoutUnit + supplierToPrepLot/units + prepUnit + otherPrepLot/units + prepToAmazonLot/units`

`pilotCapital = landedUnit * units`

`capitalExposure = pilotCapital / budget`

Estas cifras son capital desembolsado antes de vender. Referral fee, FBA fee, publicidad, almacenamiento y devoluciones se tratarán después como costos económicos/variables.

## B. Prep Center
MVP visible:
- Prep Center por unidad.
- Otros costos Prep del lote.
- Flete Prep → Amazon del lote.

No abrir todavía un catálogo de tarifas por servicio. Eso queda para fase avanzada.

## C. Devoluciones Amazon
Registrar:
- tasa esperada de devolución;
- % revendible;
- removal cost por unidad;
- costo de preparación de devolución por unidad;
- costo de reenvío a Amazon por unidad.

En esta fase NO se inventa una pérdida esperada completa porque faltan datos para modelar correctamente unidades dañadas/no revendibles y recuperación real. Los campos deben quedar disponibles para Risk y Financial Score posteriores.

## D. UX
Añadir dos bloques plegables debajo de `Plan de salida`:
- `Costo real y Prep Center`
- `Devoluciones Amazon`

Añadir a la derecha un resumen compacto `Capital antes de vender` con:
- costo checkout/unidad;
- landed cost/unidad;
- capital piloto;
- exposición sobre presupuesto;
- estado de datos de devoluciones.

## Reglas
- No sobrescribir silenciosamente `p_cogs` ni `p_flete` del calculador heredado.
- Si faltan datos, mostrar `INCOMPLETO`, no inventar valores.
- Si el capital del lote supera el presupuesto, mostrar señal roja.
- Para producto nuevo, si unidades >5, mostrar advertencia de que excede el piloto inicial acordado. No bloquear todavía porque más adelante REPONER/ESCALAR usará cantidades mayores.
- Devoluciones 0% no deben tratarse como supuesto por defecto. Si no se ha verificado, mostrar `NO VERIFICADO`.

## Persistencia
Extender `jev_v1`:

```js
costs: {
  checkout: {
    displayedUnit: null,
    discountUnit: 0,
    taxUnit: null,
    supplierToPrepLot: null
  },
  prep: {
    prepUnit: null,
    otherPrepLot: 0,
    prepToAmazonLot: null
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
1. Fases 1 y 2 siguen funcionando.
2. Se calcula checkout unitario sin usar precio mostrado como costo final.
3. Prep Center entra en el costo landed.
4. Fletes proveedor→Prep y Prep→Amazon se separan.
5. Se calcula capital piloto y exposición al presupuesto.
6. >5 unidades genera advertencia de piloto inicial, no hard gate.
7. Devoluciones tienen datos propios y no se confunden con devolución al retailer.
8. No se inventa un costo final de devolución sin datos suficientes.
9. Persistencia `jev_v1` conserva fases anteriores.
10. No se modifica `main`.
