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

## Pruebas manuales pendientes antes de merge
1. Abrir PWA y confirmar Ciclo de caja.
2. Abrir Análisis de producto y confirmar cálculo financiero.
3. Cargar ASIN/UPC/marca/categoría y recargar: deben persistir.
4. Probar NO VERIFICADO → ESPERAR.
5. Probar REQUIERE APROBACIÓN → ESPERAR.
6. Probar NO AUTORIZADO → DESCARTAR.
7. Probar AUTORIZADO → permite continuar.
8. Verificar vista móvil.
9. Verificar recarga offline después de una carga online.
10. Solo después de estas pruebas considerar merge a `main`.
