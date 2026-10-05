# Cómo instalar la Calculadora FBA

*Proyecto Amazon FBA · 29 de agosto de 2026*

---

## Qué contiene esta carpeta

```
fba-calculadora/
├── index.html      ← la aplicación completa
├── manifest.json   ← le dice al teléfono que es instalable
├── sw.js           ← hace que funcione sin internet
├── icons/          ← los íconos de la app
└── INSTRUCCIONES.md
```

No hay que instalar nada, ni compilar, ni usar la terminal. Son archivos sueltos que se suben tal cual.

---

## Antes que nada: la parte importante

Para que Android y Windows la reconozcan como app instalable, **tiene que estar publicada en una dirección https**. No funciona abriendo el archivo desde tu disco duro.

Publicarla es gratis y toma unos tres minutos. Es el único paso obligatorio.

---

# Paso 1 — Publicarla (una sola vez)

## Opción recomendada: Netlify Drop

Es literalmente arrastrar una carpeta.

1. Entra a **https://app.netlify.com/drop**
2. Arrastra la carpeta `fba-calculadora` completa al recuadro
3. Espera unos segundos

Listo. Te da una dirección tipo `https://algo-random-123.netlify.app`

**Para cambiarle el nombre a algo memorable:**
- Crea una cuenta gratis (con Google o correo)
- En el panel: *Site configuration* → *Change site name*
- Ponle algo como `fba-calc-nuestro`
- Queda en `https://fba-calc-nuestro.netlify.app`

Anota esa dirección. Es la que van a usar tú y tu pareja.

## Alternativa: GitHub Pages

Si prefieres tener el código versionado (y dado que vamos a seguir modificándolo, tiene sentido):

1. Crea un repositorio nuevo en GitHub
2. Sube los archivos
3. *Settings* → *Pages* → Source: rama `main`, carpeta `/root`
4. Guarda y espera unos minutos

Queda en `https://tuusuario.github.io/nombre-repo/`

---

# Paso 2 — Instalarla en Android

1. Abre la dirección en **Chrome** (debe ser Chrome, no otro navegador)
2. Va a aparecer un botón verde abajo que dice **"Instalar la calculadora"**. Tócalo.
3. Si no aparece: menú de tres puntos → **"Instalar aplicación"** o **"Agregar a pantalla de inicio"**
4. Confirma

Queda con ícono propio en el cajón de aplicaciones, se abre en pantalla completa sin barra de navegador, y funciona sin señal.

> **Esto es lo que más te sirve:** tu pareja puede tenerla en el celular y verificar los números **parada en el pasillo de la tienda**, antes de pagar. Deja de ser "compramos y después analizamos".

---

# Paso 3 — Instalarla en tu PC

## Windows o Linux (Chrome o Edge)

1. Abre la dirección
2. En la barra de direcciones, a la derecha, aparece un ícono de **monitor con una flecha hacia abajo**
3. Clic → **Instalar**

También sirve: menú de tres puntos → *Guardar y compartir* → *Instalar página como aplicación*.

Queda en el menú de inicio como cualquier programa, con su propia ventana.

## Mac

- **Chrome o Edge:** igual que arriba
- **Safari:** menú *Archivo* → *Añadir al Dock*

---

# Paso 4 — Instalarla en iPhone (si aplica)

Safari no muestra botón automático. Hay que hacerlo a mano:

1. Abre la dirección en **Safari**
2. Toca el botón de compartir (el cuadrado con la flecha)
3. Baja y toca **"Agregar a inicio"**

---

## Cómo actualizarla cuando la modifiquemos

Esta es la ventaja de haberla hecho así:

1. Yo te entrego los archivos nuevos
2. Los vuelves a arrastrar a Netlify (o los subes a GitHub)
3. **Todos los dispositivos se actualizan solos** la próxima vez que la abran

No hay que reinstalar nada en ningún teléfono. Con un APK tendrías que repetir la instalación en cada dispositivo, cada vez.

---

## Si igual quieres el archivo APK

Una vez publicada, generar el APK no requiere programar nada:

1. Entra a **https://www.pwabuilder.com**
2. Pega la dirección de tu app
3. Clic en *Package for stores* → *Android*
4. Descarga el `.apk`

Para instalarlo en tu teléfono tendrás que permitir "instalar apps de origen desconocido" en los ajustes de Android.

**Mi recomendación sigue siendo no hacerlo todavía.** Mientras estemos modificando la herramienta, el APK te obliga a regenerar y reinstalar en cada cambio. Cuando la calculadora se estabilice, lo generamos.

---

## Cosas que conviene saber

**Guarda tus datos automáticamente.** Los valores que escribas quedan en el dispositivo. Si cierras y vuelves a abrir, siguen ahí. Cada dispositivo guarda los suyos por separado: lo que escriba tu pareja en su celular no aparece en tu PC.

**Funciona sin internet.** Después de abrirla la primera vez, funciona en modo avión. Toda la lógica está en el dispositivo y no consulta ningún servidor.

**No envía nada a ninguna parte.** No hay analítica, no hay servidores, no hay cuentas. Los números que escribas no salen de tu dispositivo.

**Es gratis y no caduca.** Netlify y GitHub Pages tienen planes gratuitos que cubren de sobra este uso.

---

## Si algo no funciona

| Problema | Causa probable | Solución |
|---|---|---|
| No aparece el botón de instalar | La abriste desde el archivo local, no desde una dirección https | Publícala primero (Paso 1) |
| No aparece en Android | Estás usando otro navegador | Ábrela en Chrome |
| Los cambios no se ven después de actualizar | El navegador guardó la versión vieja | Ciérrala completamente y ábrela de nuevo, o borra caché del sitio |
| Se ve mal en el celular | Pantalla muy angosta | La tabla de escenarios se desliza horizontalmente con el dedo |

---

## Verificación rápida de que quedó bien instalada

Abre la app y en la pestaña **Ciclo de caja** pon:

- Fecha de compra: **20 de agosto de 2026**
- Activación: **21** · Venta: **14** · Envío: **3**
- Cortes: **1** y **15** · Transferencia: **4**

Debe darte:

- Dinero en tu banco: **19 oct 2026**
- Ciclo total: **60 días**
- Ciclos por año: **6,1**
- Tiempo muerto: **11 días**

Si te da eso, está funcionando correctamente. Es el mismo ejercicio que resolvimos a mano en la Clase 1.
