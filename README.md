# Calculadora-FBA-Amazon-Compuesto

PWA de análisis y decisión para Amazon FBA/OA/RA basada en rentabilidad, rotación, riesgo, elegibilidad y crecimiento compuesto.

## Estado de ramas

- `main`: versión estable/anterior conservada deliberadamente como respaldo. No se usa como rama activa de desarrollo del Motor Scoring.
- `feature/jev-v1`: rama activa de desarrollo del Calculador Amazon Compuesto. Aquí viven Motor Scoring, mercado, rotación, riesgo, operaciones, capital y la integración complementaria con JEV.

No fusionar `feature/jev-v1` a `main` únicamente por “ordenar” el repositorio. La separación actual es una decisión de control de riesgo y debe cerrarse cuando la versión activa sea validada y exista un plan explícito para despliegue/rollback.

## Datos locales y respaldo

Los datos operativos se almacenan localmente en el navegador. La versión activa incorpora herramientas para:

- exportar un respaldo JSON de los datos de la aplicación;
- restaurar un respaldo validado;
- importar un prospecto JSON procedente del Sourcing Scanner.

El respaldo debe guardarse fuera del navegador/equipo cuando contenga operaciones reales.

## Scanner → Calculador

La integración v1 mantiene ambos sistemas desacoplados mediante JSON. El contrato canónico está en `docs/SCANNER_IMPORT_CONTRACT_V1.md`.

La presencia de Amazon como vendedor se conserva como señal fuerte de riesgo/competencia. **No es un hard gate automático en esta versión**; cualquier cambio de esa política requiere una decisión comercial explícita antes de modificar el Motor Scoring.

## Pruebas

Requisitos: Node.js 18 o superior.

```bash
npm install
npm test
```

`npm test` ejecuta las cinco suites actuales de forma secuencial y `package.json` declara `jsdom`, por lo que el entorno deja de depender de una instalación manual no documentada.
