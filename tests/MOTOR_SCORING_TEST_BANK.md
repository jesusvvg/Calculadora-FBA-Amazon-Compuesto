# Banco de pruebas · Motor Scoring v1

Objetivo: intentar romper el Motor Scoring antes de usar dinero real. Estos casos no validan ventas futuras; validan que las reglas sean coherentes con protección de capital, rotación y calidad de datos.

## Regla de ejecución
1. Cargar cada escenario manualmente en la PWA.
2. Registrar scores, Data Confidence, decisión y explicación.
3. Comparar con el resultado esperado.
4. Si el motor recomienda una acción más agresiva que la esperada, marcar FALLO CRÍTICO.
5. No ajustar pesos para “hacer pasar” un solo caso: buscar la causa estructural.

## Casos adversariales

| ID | Escenario | Señal atractiva | Riesgo/trampa | Resultado mínimo esperado |
|---|---|---|---|---|
| T01 | ROI alto + rotación muy lenta | ROI y margen altos | Days to Cash >120 días | ESPERAR |
| T02 | Margen moderado + rotación rápida | DTC <=30–45 días | Margen suficiente, sin otros bloqueos | Puede llegar a COMPRAR PILOTO |
| T03 | Competencia creciendo fuerte | Finanzas buenas | Sellers +50% o más | Penalización fuerte; no ESCALAR |
| T04 | Precio actual inflado | ROI actual excelente | Precio >15% sobre histórico 90d | Advertencia y escenario conservador |
| T05 | Amazon compite | Finanzas atractivas | Amazon = SÍ | Riesgo competitivo alto; piloto solo si resto es sólido |
| T06 | Concentración de capital | Producto atractivo | Piloto >35% capital desplegable | Advertencia/penalización; evitar compra agresiva |
| T07 | Datos críticos incompletos | Algunos scores buenos | Costos/devoluciones/mercado faltantes | ESPERAR por baja confianza |
| T08 | No autorizado | ROI excepcional | Elegibilidad = NO AUTORIZADO | DESCARTAR siempre |
| T09 | Requiere aprobación | ROI excepcional | Elegibilidad = REQUIERE APROBACIÓN | ESPERAR siempre |
| T10 | Match incorrecto | Producto rentable | Producto != ASIN/listing | DESCARTAR siempre |
| T11 | Economía bajo break-even | Rotación excelente | Beneficio <=0 / break-even >= precio | DESCARTAR |
| T12 | Guerra de precios | Demanda alta | Guerra de precios ALTA | Risk Score debe subir materialmente |
| T13 | Devoluciones elevadas | ROI bruto atractivo | Return rate >=10% | Rentabilidad/riesgo deben deteriorarse |
| T14 | Sin plan de salida | Precio y demanda buenos | Sin devolución/final sale | Riesgo mayor; no tratar como dato neutro |
| T15 | Caso equilibrado | Todo razonable | Sin banderas críticas | COMPRAR PILOTO, nunca REPONER/ESCALAR sin histórico real |

## Invariantes obligatorios
- NO AUTORIZADO -> DESCARTAR.
- REQUIERE APROBACIÓN -> ESPERAR.
- NO VERIFICADO en elegibilidad -> ESPERAR.
- Match NO COINCIDE -> DESCARTAR.
- Datos críticos insuficientes -> no recomendación fuerte.
- Producto candidato nuevo -> máximo piloto pequeño.
- REPONER y ESCALAR permanecen bloqueados hasta tener resultados reales.
- Un score alto nunca puede anular una puerta obligatoria.
- Risk Score alto o DTC extremo deben poder frenar una oportunidad financieramente atractiva.
- Los scores son heurísticos, no probabilidades.

## Criterio de aprobación del Motor Scoring v1
El motor pasa esta etapa cuando:
- 0 fallos en puertas obligatorias;
- 0 recomendaciones de compra con datos críticos insuficientes;
- 0 recomendaciones de compra en escenarios de pérdida/break-even;
- los casos contradictorios producen explicaciones coherentes;
- ninguna métrica aislada domina una decisión contra la estrategia de capital.

Después de superar este banco, validar con operaciones reales y comparar predicción vs resultado antes de recalibrar pesos.
