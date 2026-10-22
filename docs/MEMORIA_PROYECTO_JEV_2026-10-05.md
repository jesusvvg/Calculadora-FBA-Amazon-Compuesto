# Calculador Amazon Compuesto — Memoria de avance JEV v1

**Fecha:** 2026-10-05  
**Repositorio:** `jesusvvg/Calculadora-FBA-Amazon-Compuesto`  
**Rama de desarrollo:** `feature/jev-v1`  
**Estado:** desarrollo funcional en curso; `main` conserva la calculadora original.

---

## 1. Objetivo del proyecto

El sistema no busca “productos ganadores” ni promete predecir el futuro. Su objetivo es ayudar a tomar mejores decisiones de compra para Amazon FBA/OA/RA con capital limitado, priorizando:

1. Proteger capital.
2. Verificar que el producto se pueda vender.
3. Recuperar capital con rapidez.
4. Obtener rentabilidad razonable.
5. Reinvertir.
6. Diversificar progresivamente.
7. Escalar solo productos o patrones validados.

Principio operativo:

`Capital → compra pequeña → venta → recuperación → ganancia → reinversión → mayor capital`

Se prefiere una ganancia moderada con alta rotación antes que una ganancia alta con inventario inmovilizado durante meses.

---

## 2. Arquitectura acordada

La PWA original se conserva y se evoluciona; no se reconstruye desde cero.

Cadena conceptual de JEV:

`Elegibilidad → Match/Marca/Fuente/Salida → Costo real/Prep/Devoluciones → Financial → Market → Rotation → Risk → Capital Efficiency → Data Confidence → Decisión JEV`

La app seguirá siendo PWA, usable desde navegador, PC y móvil. En esta etapa la entrada de datos es manual. APIs se integrarán después.

---

## 3. Estrategia de capital y piloto

Para productos nuevos:

- Estado inicial: `CANDIDATO`.
- Piloto inicial: **máximo 5 unidades**.
- No concentrar gran parte del capital en un producto nuevo.
- Mantener reserva de liquidez.
- El piloto termina cuando:
  - se venden todas las unidades y se recupera el capital, o
  - se cumplen 90 días desde la activación en Amazon.

No se debe esperar artificialmente 90 días si el ciclo se cierra antes.

Evolución prevista:

- Fase 1: 1 producto, hasta 5 unidades.
- Fase 2: hasta 2 productos, alrededor de 10 unidades según validación.
- Fase 3: hasta 3 productos, alrededor de 15 unidades según validación.
- Posteriormente: 20+ unidades solo con evidencia real positiva.

`REPONER` y `ESCALAR` permanecen bloqueados hasta tener resultados reales de pilotos.

---

## 4. Elegibilidad Amazon — puerta obligatoria

Estados:

- `AUTORIZADO`
- `REQUIERE APROBACIÓN`
- `NO AUTORIZADO`
- `NO VERIFICADO`

Reglas:

- `NO AUTORIZADO → DESCARTAR`
- `NO VERIFICADO → ESPERAR`
- `REQUIERE APROBACIÓN → ESPERAR`
- Solo `AUTORIZADO` permite continuar.

JEV nunca recomienda comprar un producto no autorizado o no verificado.

Campos implementados:

- ASIN
- UPC/EAN
- Marca
- Categoría
- Marketplace
- Condición
- Estado de elegibilidad

---

## 5. Pre-check: Match, marca, fuente y plan de salida

### Match producto ↔ ASIN

Estados:

- `NO VERIFICADO`
- `MATCH CONFIRMADO`
- `MATCH DUDOSO`
- `NO COINCIDE`

Reglas principales:

- `NO COINCIDE → DESCARTAR`
- `MATCH DUDOSO / NO VERIFICADO → ESPERAR`

### Política de marca

Estados:

- `NO VERIFICADA`
- `SIN PROHIBICIÓN ENCONTRADA`
- `AUTORIZACIÓN EXPLÍCITA`
- `RESTRICCIÓN EXPLÍCITA AMAZON`

Regla clave:

**“Sin prohibición encontrada” no equivale a autorización de la marca.**

### Fuente / supply chain

Se registra:

- tipo de fuente: retailer / distribuidor / marca directa / otro;
- proveedor/retailer;
- URL/referencia de compra;
- autenticidad/trazabilidad;
- documento disponible.

### Plan de salida

Se registra:

- si permite devolución;
- ventana de devolución;
- restocking fee;
- quién paga retorno;
- final sale;
- notas.

No poder devolver al retailer aumenta riesgo, pero no descarta automáticamente.

---

## 6. Costo real + Prep Center

Se separó el costo real de adquisición del simple COGS.

Flujo esperado:

`precio mostrado - descuento/cupón + impuesto + proveedor→Prep + Prep + Prep→Amazon`

Campos implementados:

- precio mostrado/u;
- descuento/cupón/u;
- impuesto/u;
- flete proveedor → Prep Center (lote);
- Prep Center/u;
- otros costos Prep del lote;
- flete Prep → Amazon del lote.

El resumen calcula:

- checkout/u;
- landed cost/u;
- capital del lote;
- exposición sobre presupuesto.

Si faltan datos críticos, el resultado queda `INCOMPLETO`; JEV no inventa valores.

---

## 7. Devoluciones Amazon

Ya se contemplan como parte del sistema.

Campos:

- tasa esperada de devolución;
- % esperado revendible;
- removal cost/u;
- prep de devolución/u;
- reenvío a Amazon/u.

Regla conceptual:

Una devolución revendible no se trata automáticamente como pérdida total.

Las devoluciones afectan Financial Score y Risk Score cuando los datos están completos.

---

## 8. Market Score v1

Entrada manual inicial:

- BSR actual;
- tendencia BSR;
- ventas estimadas/mes;
- precio promedio 30/90/180 días;
- mínimo reciente;
- estabilidad de precio;
- sellers FBA actuales;
- sellers FBA hace 30 días;
- Amazon como vendedor;
- Buy Box;
- estacionalidad.

Market Score usa señales de:

- demanda;
- precio;
- competencia;
- Amazon;
- Buy Box;
- estacionalidad.

El score es heurístico, redondeado en bloques de 5, y no representa probabilidad de éxito.

Regla importante:

`ventas estimadas ÷ sellers` se usa solo como presión teórica de demanda, **no como predicción de ventas del usuario**.

Un Market Score bajo por sí solo no descarta automáticamente.

---

## 9. Rotation Score v1

Objetivo: medir qué tan rápido puede recuperarse y reutilizarse el capital.

Componentes:

- Days to Cash;
- presión de demanda;
- Buy Box;
- estabilidad;
- sell-through esperado a 90 días.

Bandas conceptuales de Days to Cash para capital limitado:

- ≤30 días: excelente;
- 31–45: bueno;
- 46–60: aceptable;
- 61–75: lento;
- 76–90: muy lento;
- >90: evitar inicialmente salvo excepción justificada.

Un DTC >120 días se considera señal fuerte para `ESPERAR`.

---

## 10. Risk Score v1

Evalúa:

- concentración de capital;
- riesgo de caída de precio;
- crecimiento de sellers;
- Amazon como competidor;
- guerra de precios;
- estacionalidad;
- devoluciones;
- plan de salida/origen;
- inventario inmovilizado.

Escala conceptual:

- 0 = menor riesgo;
- 100 = mayor riesgo.

Lo desconocido no se interpreta como seguro: reduce cobertura/confianza.

---

## 11. Financial Score v1

Ya no depende solo del cálculo financiero antiguo.

Usa:

- precio de venta;
- referral fee;
- FBA fee;
- landed cost real;
- almacenamiento;
- publicidad;
- impacto esperado de devoluciones.

Calcula:

- beneficio neto/u;
- margen neto;
- ROI/ciclo;
- break-even;
- tolerancia de caída de precio;
- escenario pesimista.

Componentes actuales:

- Margen: 25%
- ROI/ciclo: 30%
- Beneficio/u: 15%
- Tolerancia de caída: 15%
- Escenario pesimista: 15%

Hard gates económicos:

- beneficio neto ≤ 0 → `DESCARTAR`;
- break-even ≥ precio de venta → `DESCARTAR`.

El viejo veredicto aritmético se oculta cuando JEV está activo para evitar decisiones contradictorias.

---

## 12. Capital Efficiency Score

Su propósito es favorecer recuperación y reutilización del capital, no solo ROI.

Variables:

- ROI ajustado a velocidad;
- Days to Cash;
- concentración del capital.

Concepto clave:

Un producto con menor ROI pero mucho menor DTC puede ser mejor para crecimiento compuesto.

Ejemplo conceptual:

- Producto A: ROI 14%, DTC 60 días.
- Producto B: ROI 12%, DTC 30 días.

JEV puede preferir B por mejor velocidad de capital.

La app incluye un campo de **reserva de liquidez objetivo**.

`Capital desplegable = presupuesto − reserva`

---

## 13. Data Confidence

JEV mide cobertura y calidad de datos; no “rellena” datos faltantes.

Factores actuales:

- elegibilidad;
- match/pre-check;
- costo real;
- mercado;
- devoluciones;
- rotación/riesgo;
- frescura.

Data Confidence no es probabilidad de éxito.

Si faltan datos críticos, JEV evita recomendaciones fuertes.

---

## 14. Motor de decisión JEV v1

JEV no es un promedio simple.

Orden de decisión:

1. Puertas obligatorias.
2. Datos críticos.
3. Hard gates financieros.
4. Financial Score.
5. Market Score.
6. Rotation Score.
7. Risk Score.
8. Capital Efficiency.
9. Data Confidence.
10. Restricciones por etapa.

Resultados posibles:

- `COMPRAR PILOTO`
- `REPONER`
- `ESCALAR`
- `ESPERAR`
- `DESCARTAR`

En la versión actual para un candidato nuevo:

- puede emitir `COMPRAR PILOTO`, `ESPERAR` o `DESCARTAR`;
- `REPONER` y `ESCALAR` siguen bloqueados hasta registrar resultados reales.

La recomendación máxima para un candidato nuevo es un piloto de hasta 5 unidades.

---

## 15. Ejemplo de razonamiento actual observado

Estado probado:

- Elegibilidad: `AUTORIZADO`.
- Match: `MATCH CONFIRMADO`.
- Marca: `SIN PROHIBICIÓN ENCONTRADA`.
- Fuente: `RETAILER · RAZONABLE`.
- Plan de salida: no verificado.
- Costos reales/Prep: incompletos.
- Devoluciones Amazon: no verificadas.

Razonamiento de JEV:

1. Puede vender → continúa.
2. Match correcto → continúa.
3. No hay bloqueo de marca conocido → continúa con advertencia.
4. Fuente razonable → continúa con advertencia.
5. Plan de salida incompleto → aumenta incertidumbre.
6. Checkout/landed cost incompleto → Financial Score no puede cerrarse.
7. Devoluciones incompletas → economía real insuficientemente conocida.
8. Data Confidence media, pero con datos críticos faltantes.
9. No existe evidencia suficiente para comprar ni para descartar.
10. Decisión: **ESPERAR**.

Este comportamiento es intencional: un ROI atractivo de la calculadora heredada no puede saltarse datos críticos todavía no verificados.

---

## 16. Estado de GitHub

- Repositorio público creado.
- GitHub Pages configurado temporalmente sobre `feature/jev-v1` para pruebas.
- `main` conserva la calculadora original.
- Desarrollo JEV aislado en `feature/jev-v1`.
- Pull Request de trabajo creado previamente contra `main`, sin fusionar.
- Service Worker actualizado para cachear las capas JEV y mantener PWA/offline.

Archivos funcionales JEV añadidos:

- `jev-v1.js`
- `jev-phase2.js`
- `jev-phase3.js`
- `jev-phase4-market.js`
- `jev-phase5-rotation-risk.js`
- `jev-phase6-engine.js`

---

## 17. Lo próximo

Siguiente bloque funcional:

### Historial y Operaciones

Registrar **PREDICCIÓN**:

- unidades;
- inversión;
- ROI esperado;
- margen esperado;
- precio esperado;
- días de venta esperados;
- Days to Cash esperado;
- riesgo;
- JEV Score/decisión.

Registrar **REAL**:

- unidades vendidas;
- precio real;
- ROI real;
- margen real;
- devoluciones;
- días reales;
- Days to Cash real;
- beneficio/pérdida;
- inventario residual.

Comparar esperado vs real y usar el histórico posteriormente para calibrar JEV.

Después:

1. Dashboard de capital.
2. Validación con operaciones reales.
3. Integraciones API.
4. Calibración de modelos.
5. Etapa de estilos/UX/UI una vez cerrada la funcionalidad.

---

## 18. Principio de diseño que se mantiene

**Primero funcionalidad y lógica; después estilos.**

No se priorizará una interfaz bonita sobre un motor correcto, auditable y conservador.

JEV debe poder explicar siempre:

- qué datos usó;
- qué datos faltan;
- qué señales fueron favorables;
- qué riesgos detectó;
- por qué emitió `COMPRAR PILOTO`, `ESPERAR` o `DESCARTAR`;
- qué tendría que cambiar para reconsiderar la decisión.
