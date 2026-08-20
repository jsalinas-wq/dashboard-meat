# Poner el dashboard en línea — guía paso a paso

Por ahora el dashboard **no tiene contraseña**: cualquiera con el link puede verlo (así lo
pidieron). Si más adelante quieren agregarla, aviso y la sumamos — no es un cambio grande.

Vas a hacer esto una sola vez. Son dos partes: (1) publicar el sitio, (2) darme dos datos
para que yo configure la actualización automática. Ninguna parte requiere saber
programar ni usar la terminal — todo es hacer click en páginas web.

## Parte 1 — Publicar el sitio

### 1.1 — Descomprime el archivo

Descarga el archivo `meat-dashboard-netlify.zip` que te envié y descomprímelo en tu
computador (doble click, o click derecho → "Extraer todo" / "Descomprimir"). Va a
aparecer una carpeta llamada `netlify-dashboard` con varias cosas adentro — no necesitas
abrir ni entender los archivos, solo vas a subir la carpeta completa.

### 1.2 — Crea una cuenta en GitHub (gratis)

1. Ve a [github.com](https://github.com) → botón **Sign up**.
2. Sigue los pasos (correo, contraseña, nombre de usuario). Confirma tu correo si te lo
   pide.

Si ya tienes cuenta de GitHub, salta este paso.

### 1.3 — Crea un repositorio nuevo

1. Ya logueado en GitHub, arriba a la derecha click en el **+** → **New repository**.
2. En "Repository name" escribe, por ejemplo, `meat-dashboard`.
3. No marques ninguna casilla adicional (déjalo simple).
4. Click en el botón verde **Create repository**.

### 1.4 — Sube los archivos

1. En la página del repositorio recién creado (está vacío), busca el texto que dice algo
   como *"uploading an existing file"* y haz click ahí. (Si no lo ves, ve a la pestaña
   **Add file → Upload files**.)
2. Abre la carpeta `netlify-dashboard` en tu computador y selecciona **todo lo que hay
   adentro** (todos los archivos y carpetas: `public`, `netlify`, `scripts`,
   `netlify.toml`, `package.json`, `README.md`, `SETUP.md`).
3. Arrastra todo eso a la zona que dice "Drag files here to add them to your repository".
   Espera a que termine de cargar (la barra de progreso llega al final).
4. Bajo el título "Commit changes", deja todo como está y click en el botón verde
   **Commit changes**.

### 1.5 — Crea una cuenta en Netlify y conecta el repositorio

1. Ve a [netlify.com](https://www.netlify.com) → botón **Sign up**. Elige la opción
   **Sign up with GitHub** (así queda todo conectado automáticamente).
2. Autoriza el acceso cuando te lo pida.
3. En el panel de Netlify, click **Add new site → Import an existing project**.
4. Elige **Deploy with GitHub**, y selecciona el repositorio `meat-dashboard` que
   creaste.
5. Netlify va a mostrar unos campos ya completados solo — no cambies nada, solo click en
   el botón **Deploy site** (o "Deploy meat-dashboard").
6. Espera 1-2 minutos. Cuando termine, Netlify te muestra una URL parecida a
   `nombre-al-azar.netlify.app`. Ábrela — ahí está tu dashboard.

Listo, el sitio ya está en línea. Ahora falta conectar la actualización automática.

## Parte 2 — Dame estos dos datos para la actualización automática

Sin esto, el dashboard sigue funcionando pero se queda con los datos de hoy — no se va a
actualizar solo cuando agreguen meses nuevos en el Excel.

### 2.1 — El "token" de Netlify

1. En Netlify, click en tu ícono/avatar (arriba a la derecha) → **User settings**.
2. En el menú de la izquierda, click **Applications**.
3. Busca la sección **Personal access tokens** → botón **New access token**.
4. Ponle cualquier nombre (ej. `actualizacion-dashboard`) → **Generate token**.
5. Aparece un código largo — **cópialo ahora**, es la única vez que Netlify lo muestra.

### 2.2 — El "Site ID"

1. Ve al sitio que creaste (el dashboard) dentro de Netlify.
2. Click en **Site configuration** → pestaña **General**.
3. Ahí aparece **Site ID** (o "Project ID") — cópialo también.

### 2.3 — Pásamelos por este chat

Envíame el token del paso 2.1 y el Site ID del paso 2.2, y con eso dejo configurada la
actualización automática (por defecto, una vez al día — dime si prefieres otra
frecuencia). No tienes que hacer nada más después de esto.

## Después de configurado — nada que hacer

Cuando agreguen meses nuevos en `MASTER_DATA` o cambien algo en la pestaña
`METAS 2026`, no hay que tocar nada: la próxima actualización programada los recoge
sola. El pie de página del dashboard (debajo del título) siempre muestra la fecha de la
última actualización.

## Si algo no carga

- **La página carga pero sin datos / dice "No se pudo cargar la información"**: en
  Netlify, dentro del sitio, ve a **Functions → data → Function log** — ahí sale el
  detalle del error. Compárteme lo que dice y lo reviso.
- **Quieren agregar la contraseña más adelante**: solo avísame, es un cambio acotado
  (agrego de nuevo la pantalla de login que ya tenía armada).
