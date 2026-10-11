# JEV v0.1 · implementación local y activación pendiente

Fecha: 2026-10-11, America/Santiago.

## Estado entregado

El contrato, adaptador y servidor privado están implementados y se prueban con
un proveedor simulado. **No se ha realizado una llamada real a TypeSafe**, no
hay credenciales reales configuradas y no se desplegó un servidor público.

Los nuevos módulos no se cargan automáticamente desde `index.html` ni desde el
service worker. Las cuatro pestañas, el Motor Scoring, las operaciones y sus
claves de almacenamiento conservan su implementación anterior. Esta entrega
prepara la conexión y su prueba antes de añadir el panel visible de JEV.

| Archivo | Responsabilidad |
|---|---|
| `jev-observer-contract.js` | Esquema permitido, cinco preguntas, puertas, faltantes y validación de respuestas |
| `jev-observer-adapter.js` | Captura de la PWA, cálculo para lote elegido, expiración y registros separados |
| `server/jev-server.cjs` | Servidor Node privado, secreto TypeSafe, autenticación y llamada HTTP |
| `server/.env.example` | Configuración vacía; JEV desactivado |
| `tests/jev-observer.cjs` | Pruebas de página completa y HTTP con proveedor simulado |

## Arranque local sin credenciales

Requiere Node.js 22 o posterior, sin dependencias de producción.

```bash
node server/jev-server.cjs
```

Abrir `http://127.0.0.1:8787`. La calculadora puede usarse allí, pero ese origen
tiene su propio almacenamiento. Abrirla en un origen nuevo no importa las
compras que guardaste en otro navegador o dirección. No significa que se hayan
borrado. No migrar ni reemplazar datos para realizar esta prueba.

`GET /api/jev/status` devuelve JEV desactivado. La aplicación original tampoco
hace llamadas a ese endpoint automáticamente en esta entrega.

## Configuración para una llamada real

1. Obtener acceso y clave desde la consola oficial `https://console.typesafe.ai/`.
   Verificar condiciones de la cuenta y precio al habilitarla.
2. Copiar `server/.env.example` como `server/.env`, ignorado por Git.
3. Configurar `TYPESAFE_API_KEY` en ese archivo privado o en secretos del servidor.
4. Generar un secreto independiente `JEV_ACCESS_TOKEN` de al menos 32 caracteres.
   Este token protege nuestro endpoint; no es la clave del proveedor.
5. Cambiar `JEV_ENABLED` a `1`. Mantener el enlace local en 127.0.0.1.
6. Arrancar con `node --env-file=server/.env server/jev-server.cjs`.
7. Ejecutar primero una evaluación sintética y comprobar su respuesta. El
   panel de producto no debe habilitarse como servicio real antes de esa prueba.

No incluir claves en archivos públicos, URLs, código versionado o registros.
El adaptador permite un token de acceso privado únicamente en memoria. La
configuración de la clave de TypeSafe no pertenece al navegador.

## API privada implementada

```text
POST /api/jev/review
Authorization: Bearer <JEV_ACCESS_TOKEN>
Content-Type: application/json
```

El cuerpo contiene únicamente `analysisId` y `state`, según el esquema del
contrato. No acepta preguntas, modelo, URL de proveedor ni campos arbitrarios
enviados por el navegador. El servidor reconstruye las cinco preguntas fijas.

Una respuesta válida incluye `mode: OBSERVATION`, versión del contrato,
identificador de análisis, SHA-256 del estado normalizado, evaluaciones
omitidas, resultado validado y latencia. Nunca devuelve la clave del proveedor.

Autorización, match, marca, origen, rentabilidad y concentración se revisan
antes de llamar a TypeSafe. Esas condiciones reflejan los datos introducidos:
el servidor no comprueba por sí mismo la cuenta de vendedor en Amazon.

## Uso del adaptador en el próximo panel

El panel deberá cargar primero `jev-observer-contract.js` y después
`jev-observer-adapter.js`, y crear `JevObserverAdapter.browserObserver(window,
{accessToken})` únicamente después de configurar el acceso privado.

- `evaluate()` ejecuta una consulta explícita y devuelve su estado.
- `latest()` detecta que un resultado ya no corresponde al formulario actual.
- Una segunda llamada mientras hay una en curso devuelve `PENDING`.
- Un cambio de ASIN, cantidad, costo, precio o capital invalida el uso del
  resultado; la observación conserva la identidad original.
- Si la compra usa cantidad o inversión distintas de la recomendación, el
  registro marca `recommendationAppliesToChosenLot: false`. No debe mostrarse
  concordancia de decisiones sobre lotes diferentes.
- Los registros se guardan en `amazon_compuesto_jev_observations_v01`, con los
  últimos 100 resultados. No modifica ninguna clave de compras o de capital.
- Si falla ese guardado, se devuelve `saved: false` sin tocar las operaciones.
- Los juicios sin mínimos de datos o con mercado de antigüedad desconocida o
  superior a 30 días se omiten. Esa ventana es una política inicial de uso de
  datos; no garantiza actualidad suficiente para todos los productos.

## Límites de esta implementación

- Seis intentos por minuto, cien por día y dos consultas concurrentes por
  proceso. Se cuentan intentos antes de la llamada, incluso si el proveedor
  falla. No hay reintentos automáticos.
- Cuerpo de entrada limitado a 16 KiB y respuesta del proveedor a 64 KiB.
- Diez segundos de timeout del proveedor; doce segundos en el cliente.
- Solo el endpoint oficial y el modelo `jev-1.13.0`; redirecciones rechazadas.
- Host y origen verificados. No hay CORS abierto. Los archivos del servidor,
  configuración y documentos privados no se sirven como contenido público.
- Los límites y métricas viven en memoria. Se reinician al reiniciar el
  proceso y no coordinan múltiples instancias. **Este servidor es para prueba
  privada local; no se entrega como despliegue público listo.**
- Para producción: persistir cuotas, gestionar sesiones de usuario, usar HTTPS
  y revisar el proxy bajo el mismo origen. No publicar este proceso aislado
  como un endpoint abierto ni sustituir autenticación por CORS.
- Los resultados muestran categoría, probabilidad y confianza separadas.
  Ningún resultado permite comprar, reponer, escalar o liberar capital.

## Validación

Las pruebas requieren `jsdom` como dependencia de desarrollo. Puede instalarse
en un directorio de pruebas separado y usar `NODE_PATH`.

```bash
node tests/jev-observer.cjs
node tests/operation-close.cjs
node tests/multiple-asins.cjs
```

Las pruebas usan almacenamiento sintético y HTTP local. Simulan TypeSafe para
comprobar integración y fallos; no miden su precisión ni rentabilidad comercial.

Resultado verificado el 2026-10-11: las tres suites anteriores pasaron. Se
comprobaron las puertas obligatorias, el lote elegido y sus costos, los errores
del proveedor, la caducidad de resultados, los límites del servidor y los fallos
de almacenamiento. Las regresiones de cierres y de múltiples ASIN también
pasaron. Se verificó que los archivos originales de interfaz, cálculo,
operaciones y caché no cambiaron.

Próximo bloque: configuración privada de credenciales, primera llamada real,
panel opcional y comparación de juicios en observación. La rama de respaldo
anterior a JEV permanece en el commit `e2f96b15b1605d3a0f83fa539a98ef0b122531fc`.
