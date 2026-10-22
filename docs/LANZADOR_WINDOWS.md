# Calculadora local con doble clic

Requiere Windows, Node.js 22 o posterior y Git ya instalado. No instala paquetes.

## Primera vez

En la copia de pruebas, rama `feature/jev-v1`, descarga los lanzadores con
`git pull --ff-only`. Detén una vez el servidor anterior con Ctrl+C en su
PowerShell. Después abre `Abrir-calculadora.cmd` con doble clic.

Los tres archivos están en la raíz del proyecto. Puedes crear accesos directos
en el escritorio; conserva los archivos originales dentro del proyecto.

| Archivo | Acción |
|---|---|
| `Abrir-calculadora.cmd` | Inicia el servidor en segundo plano y abre el navegador; reutiliza el servidor si ya funciona. |
| `Actualizar-calculadora.cmd` | Descarga `feature/jev-v1` con avance directo, reinicia el servidor administrado y abre la calculadora. Si ya tenías una pestaña abierta, pulsa Ctrl+F5. |
| `Cerrar-calculadora.cmd` | Cierra únicamente el servidor iniciado por este lanzador. Cerrar el navegador por sí solo mantiene el servidor funcionando. |

La actualización se solicita con doble clic; abrir la calculadora no descarga
cambios automáticamente. Git puede pedir autenticación si tu sesión lo requiere.
El servidor se inicia nuevamente después de reiniciar Windows al hacer doble
clic en Abrir. No se configura un servicio al inicio de Windows.

Se conserva `http://127.0.0.1:8787/` (o PORT configurado) y se carga
`server/.env` sin editarlo. Usa el mismo navegador/perfil donde están tus
registros. El lanzador no mueve ni borra almacenamiento del navegador, no
registra compras/cargos ni hace consultas pagadas a Jev. El acceso privado
del panel sigue su flujo actual.

## Si aparece un error

- Servidor manual: detén su PowerShell con Ctrl+C una vez, y vuelve a abrir.
- Cambios locales, rama incorrecta o pull rechazado: el lanzador se detiene,
  conserva los archivos locales y deja funcionando el servidor anterior.
- Puerto ocupado por otro servicio: no lo cierra ni elige otro puerto.
- Error de arranque: consulta `.calculator-runtime/server-error.log`.
- Otra apertura o actualización en curso: espera a que termine.

Los registros de ejecución y el control local quedan en
`.calculator-runtime/`, excluido de Git. El cierre usa un canal local privado
en 127.0.0.1 con un secreto por ejecución; no mata procesos por nombre ni por un PID viejo.

## Validación

`node --test tests/calculadora-launcher.cjs`

Las pruebas usan el servidor real en modo Jev desactivado y repositorios Git
temporales locales. No utilizan claves ni llamadas al proveedor. Las pruebas
automatizadas del núcleo pueden ejecutarse en Linux; la apertura de Explorer,
los archivos CMD requieren comprobación final en Windows.
