# JEV v0.1 · conexión local verificada y panel de observación

Fecha: 2026-10-11, America/Santiago.

## Estado entregado

El contrato, adaptador, servidor privado y panel de observación están
implementados. Jesús ejecutó la primera consulta real desde su equipo Windows
el 2026-10-11: `READY`, modo `OBSERVATION`, escenario `SIMULATED`, modelo
`jev-1.13.0`, 1.950 tokens de entrada y 239 de salida. Las credenciales permanecen
en su archivo local privado. No se desplegó un servidor público.

`index.html` carga los módulos del observador. El panel se monta únicamente en
localhost y consulta el estado local al abrirse, sin llamar al proveedor.
Cada consulta pagada requiere acceso privado y pulsar el botón correspondiente.
Las cuatro pestañas, el Motor Scoring, las operaciones y sus claves de
almacenamiento conservan su implementación. Las observaciones se guardan en
una clave separada; los cambios en los datos invalidan la observación visible.
El service worker incluye los módulos y excluye `/api/` de su caché y del
contenido de respaldo sin conexión.

| Archivo | Responsabilidad |
|---|---|
| `jev-observer-contract.js` | Esquema permitido, cinco preguntas, puertas, faltantes y validación de respuestas |
| `jev-observer-adapter.js` | Captura de la PWA, cálculo para lote elegido, expiración y registros separados |
| `jev-observer-panel.js` | Acceso temporal, consulta explícita y resultados independientes en la copia local |
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

Sin cargar credenciales, `GET /api/jev/status` devuelve JEV desactivado.
El panel hace esta comprobación gratuita al abrirse y permite repetirla
manualmente. No llama al proveedor automáticamente.

## Configuración para una llamada real

1. Obtener acceso y clave desde la consola oficial `https://console.typesafe.ai/`.
   Verificar condiciones de la cuenta y precio al habilitarla.
2. Copiar `server/.env.example` como `server/.env`, ignorado por Git.
3. Configurar `TYPESAFE_API_KEY` en ese archivo privado o en secretos del servidor.
4. Generar un secreto independiente `JEV_ACCESS_TOKEN` con 32 bytes aleatorios
   codificados como 64 caracteres hexadecimales para el panel.
   Este token protege nuestro endpoint; no es la clave del proveedor.
5. Cambiar `JEV_ENABLED` a `1`. Mantener el enlace local en 127.0.0.1.
6. Arrancar con `node --env-file=server/.env server/jev-server.cjs`.
7. Ejecutar primero una evaluación sintética y comprobar su respuesta. El
   panel de producto no debe habilitarse como servicio real antes de esa prueba.

No incluir claves en archivos públicos, URLs, código versionado o registros.

### Primera prueba sintética desde PowerShell o terminal

Con el servidor ya arrancado, usar otra terminal en la carpeta del proyecto.
Validación local sin llamadas ni credenciales:

```bash
node scripts/jev-live-smoke.cjs
```

Tras confirmar `LOCAL_VALIDATION_OK`, ejecutar explícitamente una sola consulta
real mediante el servidor local autenticado (consume saldo de TypeSafe):

```bash
node --env-file=server/.env scripts/jev-live-smoke.cjs --send
```

El script usa únicamente un escenario `SIMULATED`, sin ASIN real, y muestra
modelo, respuestas validadas y tokens. Lee el token privado desde el entorno,
no imprime secretos, no guarda operaciones y no reintenta. `enabled: true` en
el estado local indica configuración cargada; solo una respuesta `READY` a
esta consulta verifica la conexión real. La primera prueba real pasó según
la salida compartida por Jesús; no se ejecutaron llamadas reales desde el
entorno de desarrollo del asistente.

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

## Uso del panel de observación

El panel carga primero `jev-observer-contract.js` y después
`jev-observer-adapter.js`, y crea `JevObserverAdapter.browserObserver(window,
{accessToken})` únicamente tras introducir el token privado.

En «Análisis de producto», al final de la sección, abrir «Acceso privado a JEV».
Pegar **JEV_ACCESS_TOKEN**, nunca la clave de TypeSafe. Puede copiarse en
PowerShell sin imprimirlo usando:

```powershell
node --env-file=server/.env -e "process.stdout.write(process.env.JEV_ACCESS_TOKEN)" | Set-Clipboard
```

Pegar directamente en el campo del panel sin copiar otro texto antes. El campo
se vacía al habilitar el acceso y el token se conserva solo en memoria hasta
recargar o bloquear la página. El Motor Scoring debe admitir el piloto y deben
existir datos suficientes antes de que se habilite «Consultar JEV».
Se muestra el lote consultado, cinco evaluaciones o sus omisiones, confianza,
probabilidades por opción y tokens. No existe un porcentaje de éxito comercial
ni un promedio combinado con el Motor Scoring.

Para datos ficticios, marcar «Escenario de prueba · datos ficticios para JEV».
El envío y su registro quedan etiquetados `SIMULATED`; cambiar esta opción
invalida una observación anterior. La opción se reinicia al recargar la página.
Las etiquetas de registro de compras y análisis atribuyen las predicciones
internas al Motor Scoring; no cambian cálculos ni claves de almacenamiento.

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
pasaron. Las pruebas del panel cubren acceso requerido, borrado del campo de
token, una sola consulta ante clics duplicados, cinco filas de resultados,
ocultación de resultados desactualizados y exclusión de la API de la caché.
Los cálculos y el comportamiento de operaciones no cambiaron; se corrigieron
sus etiquetas para distinguir el Motor Scoring del JEV externo. Se modificaron
`index.html` para cargar el panel y `sw.js` para sus archivos y la API privada.
La inspección visual se realizó mediante capturas del navegador del usuario.
No se dispuso de un ejecutable de Chromium en el entorno de desarrollo.

### Consulta manual desde el panel verificada

El 2026-10-11, a las 16:54 de America/Santiago, el usuario consultó una vez
desde el panel local con «Escenario de prueba · datos ficticios para JEV»
marcado. El ASIN inventado `B0TESTJEV0` identificó localmente un lote de una
unidad y US$19 de entrada, sin registrar una compra. Motor Scoring mostró
COMPRAR PILOTO, US$9,91 de ganancia estimada y US$181 disponibles tras el lote.
Los valores visibles incluyen los costos que estaban configurados en esa
copia local; no deben confundirse con resultados realizados.

JEV respondió con el modelo `jev-1.13.0`, 1968 tokens de entrada y 239 de
salida. El panel indicó explícitamente «Datos: escenario ficticio».

| Evaluación | Distribución de clasificaciones | Confianza |
|---|---|---:|
| Resistencia financiera | Con respaldo 32%; cautela 59%; datos insuficientes 9% | 0.38 |
| Rotación | Con respaldo 27%; sin respaldo 7%; datos insuficientes 66% | 0.49 |
| Competencia | Manejable 100%; presión 0%; datos insuficientes 0% | 1.00 |
| Inventario inmovilizado | Sin señal material 78%; riesgo 9%; datos insuficientes 13% | 0.67 |
| Evidencia para el piloto | Con respaldo para revisión 7%; sin respaldo 9%; datos insuficientes 84% | 0.76 |

Al cambiar el precio de US$39,99 a US$38,99, el usuario confirmó que las filas
de resultados desaparecieron y el panel mostró que la observación ya no
correspondía al análisis actual. No se solicitó otra consulta. Se corrigió
la repetición visual de ese aviso, conservándolo una sola vez en el estado
del panel.

Esta validación confirma la conexión y el flujo de observación. No mide la
precisión comercial de JEV ni valida demanda, elegibilidad o un producto real.
«Datos insuficientes» es una clasificación del modelo; la respuesta no
incluye una explicación ni identifica por sí misma campos faltantes.

Próximo bloque: contrastar el flujo con evidencia verificable de un producto
real y aclarar los campos heredados COGS/flete que siguen visibles aunque el
Motor Scoring utiliza el desglose de Costo real y Prep Center. El resumen de
resultados reales se conserva y aparece al existir operaciones cerradas; los
registros de la aplicación habitual no se trasladan automáticamente al origen
local. La rama de respaldo anterior a JEV permanece en el commit
`e2f96b15b1605d3a0f83fa539a98ef0b122531fc`.
