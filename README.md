# MEAT · Dashboard de rendimiento social

Dashboard interactivo de rendimiento por marca y seguimiento de metas 2026. Los datos se
actualizan automáticamente en un horario periódico (por ejemplo, una vez al día) a partir
del Google Sheet **MASTER_SOCIAL_2026** — no hace falta reconstruir nada a mano cuando se
agregan meses nuevos. No requiere una cuenta de Google Cloud.

Por ahora el sitio no tiene contraseña: el acceso es "quien tenga el link" (así se pidió
"por el momento"). Si más adelante quieren agregarla, es un cambio acotado.

**Para desplegarlo o entender cómo funciona, lee [SETUP.md](./SETUP.md) — tiene los pasos
en modo bien simple, sin necesitar terminal ni saber programar.**

## Cómo se mantiene actualizado

Una tarea programada (una "scheduled task" de Claude) corre periódicamente y hace tres
cosas: descarga el Excel desde Google Drive (usando la misma conexión de Drive que ya usa
tu cuenta de Claude, sin credenciales nuevas), extrae las filas de `MASTER_DATA` y
`METAS 2026` a JSON, y vuelve a publicar el sitio en Netlify con esos archivos
actualizados (usando un token de Netlify que Javi comparte una sola vez).

## Estructura

- `public/index.html` — página del dashboard.
- `public/app.js` — toda la lógica de renderizado (gráficos, KPIs, hallazgos, metas). Es
  el mismo motor que la versión de archivo único, adaptado para recibir los datos vía
  `DashboardApp.boot(DATA, GOALS)` en lugar de leerlos de un `<script>` embebido.
- `public/data-pipeline.js` — reproduce en el navegador la agregación que antes corría en
  Python (promedios/sumas nulos-seguros, normalización de plataforma/tipo de contenido,
  match de metas por nombre de marca). Verificado línea por línea contra la salida del
  pipeline original antes de este cambio.
- `public/boot.js` — pide los datos a la función del servidor y arranca `DashboardApp`.
- `netlify/functions/data.js` — entrega los datos empaquetados (`_data/master_data.json`,
  `_data/metas.json`). Esos archivos los refresca la tarea programada descrita en
  SETUP.md, no una llamada en vivo a Google.
- `netlify/functions/_data/` — datos empaquetados (se sobreescriben en cada actualización
  periódica); vienen con una copia inicial para que el sitio funcione desde el primer
  despliegue.
- `scripts/rebuild_data.py` — extrae las filas crudas del Excel a los JSON que sirve
  `data.js`. Es el script que corre la tarea programada en cada actualización.
