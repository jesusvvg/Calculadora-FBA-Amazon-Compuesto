# JEV v1 — Fase 1: Elegibilidad Amazon + estructura base

## Objetivo
Evolucionar la PWA existente sin reconstruirla. Mantener funcionando Ciclo de caja y Análisis financiero actuales, pero introducir una capa previa obligatoria de elegibilidad y una estructura de datos extensible para JEV.

## Principio de producto
JEV es un motor de apoyo a decisiones, no un oráculo. Debe ser conservador con el capital sin bloquear oportunidades por cualquier señal negativa. Los hard gates deben ser pocos y explícitos.

## Alcance de esta fase
Implementar SOLO:
1. Identificación del producto.
2. Elegibilidad Amazon como puerta obligatoria.
3. Estado básico de producto / etapa.
4. Persistencia local compatible con la app actual.
5. Estructura de datos preparada para módulos futuros.

NO implementar todavía Market Score, Risk Score, Capital Efficiency, Data Confidence ni JEV Score final.

## Datos nuevos
Agregar al análisis de producto:
- ASIN
- UPC/EAN
- Marca
- Categoría
- Marketplace
- Condición
- Estado de elegibilidad

### Estados exactos de elegibilidad
- AUTORIZADO
- REQUIERE APROBACIÓN
- NO AUTORIZADO
- NO VERIFICADO

## Reglas obligatorias
- NO AUTORIZADO => DESCARTAR
- NO VERIFICADO => ESPERAR
- REQUIERE APROBACIÓN => ESPERAR
- AUTORIZADO => permite continuar con el análisis financiero existente

No recomendar comprar un producto NO AUTORIZADO, NO VERIFICADO o REQUIERE APROBACIÓN.

## Flujo UI esperado
En la pestaña de análisis de producto, antes de Venta/Compra, agregar una sección visible:

### Identificación y elegibilidad
Campos:
- ASIN
- UPC/EAN
- Marca
- Categoría
- Marketplace
- Condición
- Elegibilidad

Mostrar una tarjeta resumen inmediatamente debajo:
- AUTORIZADO: verde, texto "Puede continuar al análisis"
- REQUIERE APROBACIÓN: amarillo, texto "Esperar aprobación antes de comprar"
- NO VERIFICADO: amarillo, texto "Verificar elegibilidad antes de comprar"
- NO AUTORIZADO: rojo, texto "No comprar este producto"

## Comportamiento del análisis actual
No borrar ni romper las fórmulas actuales en esta fase.

Pero el veredicto aritmético no puede sobreescribir la puerta de elegibilidad. Ejemplos:
- Elegibilidad NO AUTORIZADO + números excelentes => decisión visible: DESCARTAR por elegibilidad.
- Elegibilidad NO VERIFICADO + ROI alto => ESPERAR.
- Elegibilidad AUTORIZADO => mostrar el análisis financiero actual normalmente.

## Etapa del producto
Agregar estructura para etapa, aunque en esta fase puede quedar oculta o solo persistida:
- CANDIDATO
- PILOTO
- VALIDADO
- REPOSICIÓN
- ESCALADO
- ESPERA
- DESCARTADO

Por defecto: CANDIDATO.

## Estructura de datos JEV
Crear una estructura persistible independiente de la fuente futura de datos. Ejemplo conceptual:

```js
{
  version: 1,
  product: {
    asin: "",
    upcEan: "",
    brand: "",
    category: "",
    marketplace: "US",
    condition: "NEW",
    stage: "CANDIDATO"
  },
  eligibility: {
    status: "NO_VERIFICADO",
    source: "MANUAL",
    checkedAt: null
  },
  financial: {},
  market: {},
  risk: {},
  rotation: {},
  capitalEfficiency: {},
  dataConfidence: {},
  decision: {}
}
```

Los módulos vacíos son placeholders estructurales; NO inventar lógica todavía.

## Persistencia
- Mantener compatibilidad con los datos guardados actualmente en localStorage.
- No perder los valores existentes del usuario.
- Puede añadirse una nueva clave `jev_v1` para la nueva estructura.
- No migrar a backend en esta fase.

## UX
- Mobile first.
- No sobrecargar la pantalla.
- Mantener el estilo visual actual.
- Separar datos -> análisis -> decisión.
- La elegibilidad debe verse antes de cualquier recomendación.

## Criterios de aceptación
1. La PWA sigue abriendo y funcionando offline.
2. Ciclo de caja sigue calculando igual.
3. Análisis financiero actual sigue funcionando.
4. Se pueden ingresar y guardar ASIN/UPC/marca/categoría/marketplace/condición.
5. Elegibilidad persiste entre recargas.
6. NO AUTORIZADO produce DESCARTAR visible.
7. NO VERIFICADO produce ESPERAR visible.
8. REQUIERE APROBACIÓN produce ESPERAR visible.
9. AUTORIZADO permite continuar.
10. `main` no se toca; todo cambio se hace en `feature/jev-v1`.

## Restricciones
- No rehacer la app desde cero.
- No agregar frameworks todavía.
- No integrar APIs todavía.
- No crear scores falsos ni probabilidades.
- No cambiar reglas financieras de fondo en esta fase salvo lo necesario para que la elegibilidad tenga prioridad.
