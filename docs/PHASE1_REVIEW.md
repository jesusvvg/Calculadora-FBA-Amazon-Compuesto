# JEV v1 · Fase 1 — Revisión

## Cambios implementados
- Capa JEV separada en `jev-v1.js`.
- Identificación de producto: ASIN, UPC/EAN, marca, categoría, marketplace y condición.
- Elegibilidad Amazon con estados exactos:
  - AUTORIZADO
  - REQUIERE APROBACIÓN
  - NO AUTORIZADO
  - NO VERIFICADO
- Puerta obligatoria visible antes del resultado aritmético.
- Persistencia separada en `localStorage` con clave `jev_v1`.
- Estructura preparada para módulos futuros sin inventar scores.
- Cache offline actualizado para incluir `jev-v1.js`.

## Reglas activas
- NO AUTORIZADO → DESCARTAR.
- NO VERIFICADO → ESPERAR.
- REQUIERE APROBACIÓN → ESPERAR.
- AUTORIZADO → permite continuar al análisis financiero.

## Compatibilidad
- La clave existente `fba_v2` no se modifica.
- Las fórmulas financieras existentes no se reescribieron en esta fase.
- `main` permanece como versión pública estable.

## Revisión estática completada
- [x] `index.html` solo añade la carga de `jev-v1.js`; no reescribe fórmulas.
- [x] La capa JEV usa su propia clave `jev_v1`.
- [x] Los datos existentes en `fba_v2` no se migran ni eliminan.
- [x] Los cuatro estados de elegibilidad están implementados.
- [x] NO AUTORIZADO muestra DESCARTAR.
- [x] NO VERIFICADO y REQUIERE APROBACIÓN muestran ESPERAR.
- [x] AUTORIZADO permite consultar el análisis financiero.
- [x] El resultado financiero queda visualmente subordinado a la elegibilidad.
- [x] El service worker cambia de cache y añade `jev-v1.js` para uso offline.
- [x] `main` no contiene estos cambios.

## Pruebas visuales/manuales pendientes antes de merge
1. Abrir la rama en navegador y confirmar que Ciclo de caja mantiene el comportamiento esperado.
2. Abrir Análisis de producto y confirmar que la nueva sección aparece antes de Venta.
3. Cargar ASIN/UPC/marca/categoría y recargar: deben persistir.
4. Probar los cuatro estados de elegibilidad y verificar colores/textos.
5. Confirmar que el cálculo financiero sigue reaccionando a los cambios de datos.
6. Verificar vista móvil.
7. Verificar recarga offline después de una carga online.
8. Solo después de estas pruebas considerar merge a `main`.

## Estado
**REVISIÓN ESTÁTICA: APROBADA**

**MERGE A MAIN: BLOQUEADO hasta completar prueba visual/manual.**
