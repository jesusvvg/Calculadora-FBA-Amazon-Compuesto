# Contrato Scanner → Calculador v1

## Propósito

Permitir que el Sourcing Scanner entregue un prospecto al Calculador Amazon Compuesto sin copiar manualmente ASIN, precio, mercado y elegibilidad.

El puente sigue siendo por archivo JSON. Scanner y Calculador continúan desacoplados.

## Esquema recomendado

```json
{
  "schema": "amazon-sourcing-scanner-prospect-v1",
  "prospect": {
    "asin": "B0XXXXXXXX",
    "upcEan": "012345678901",
    "brand": "Marca",
    "category": "Categoría",
    "marketplace": "US",
    "condition": "NEW",
    "eligibility": {
      "status": "AUTORIZADO",
      "source": "SCANNER",
      "checkedAt": "2026-10-12T19:00:00.000Z"
    },
    "priceCurrent": 24.99,
    "market": {
      "bsrCurrent": 12345,
      "bsrTrend": "ESTABLE",
      "salesEstimatedMonthly": 80,
      "sellersFbaCurrent": 4,
      "sellersFba30": 3,
      "priceAvg30": 25.20,
      "priceAvg90": 24.80,
      "priceAvg180": 24.10,
      "priceMinRecent": 21.99,
      "priceStability": "ALTA",
      "buyBox": "ESTABLE",
      "amazonSeller": "NO",
      "seasonality": "BAJA"
    }
  }
}
```

## Reglas de importación

- El ASIN es obligatorio.
- La importación archiva primero el producto activo en el catálogo local.
- El prospecto importado pasa a ser el producto activo.
- El precio actual, si existe, se carga en `p_precio`.
- Elegibilidad desconocida se convierte en `NO VERIFICADO`.
- `NO AUTORIZADO` y `NO VERIFICADO` siguen sujetos a las puertas obligatorias existentes del Motor Scoring.
- La presencia de Amazon se importa como dato de mercado/riesgo. **No se convierte automáticamente en hard gate**.
- El origen de los datos de mercado importados queda marcado como `SCANNER`.
- El Calculador acepta alias simples (`bsr`, `price`, `monthlySales`, `sellers`, etc.) para tolerar versiones tempranas del Scanner, pero el formato anterior es el canónico.

## Fuera del alcance v1

- Base de datos compartida.
- Sincronización automática entre aplicaciones.
- APIs directas entre Scanner y Calculador.
- Conversión de `amazonSeller = SÍ` en `DESCARTAR`.

Esas decisiones requieren validación comercial y no pertenecen a este puente mínimo.
