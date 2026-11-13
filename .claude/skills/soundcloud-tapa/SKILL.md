---
name: soundcloud-tapa
description: Baja la tapa (artwork) y los datos de un link de SoundCloud para usarlos en la web de PVR. Usala cuando Leo pase un link de soundcloud.com (tema, EP o lista /sets/) y quiera la imagen o sumar ese lanzamiento a la web, por ejemplo a "Masterizados por PVR" en mastering.html o a la Discografía.
---

# Tapa de SoundCloud → proyecto

Cuando Leo pase uno o varios links de SoundCloud:

1. **Bajar tapa y datos** con el script (solo biblioteca estándar de Python, sin cuenta de SoundCloud). Correrlo desde la carpeta `pvr-web`, un link por vez:

   ```bash
   python -I .claude/skills/soundcloud-tapa/scripts/tapa.py "<link>" --out img/masters
   ```

   - Limpia el link solo (saca `?si=`, `utm_…`). Usá el `link` limpio que devuelve en la web, nunca el que tiene rastreo.
   - Por defecto baja la tapa en 500×500 (alcanza para la grilla). `--grande` intenta la original.
   - `--nombre archivo` fija el nombre del archivo; si no, lo arma con artista y tema.
   - Carpeta según destino: masterizados → `img/masters/`; discografía propia → `img/` con el nombre `cover-<slug>.jpg`, como las demás tapas.
   - Devuelve JSON con `titulo_soundcloud`, `cuenta` (quién lo subió: suele ser el sello), `artista`, `tema`, `es_lista` y `tapa` (archivo guardado).

2. **Revisar los datos antes de cargarlos.** El título de SoundCloud viene sucio (sellos, "Free Download", "Premiere:", "by …"); cuando la cuenta es un canal de estrenos y no el sello, el sello suele estar en la tapa. Mirar `titulo_soundcloud` y armar un título prolijo. Si no está claro quién es el artista o cuál es el sello, preguntarle a Leo en vez de inventar.

3. **Mirar la tapa** con Read antes de usarla (que sea la correcta). Si `posible_placeholder` es true, SoundCloud devolvió su logo gris (pasa con listas sin tapa propia): borrar ese archivo y buscar la tapa en otro lado (por ejemplo, para los lanzamientos de PVR ya están en `img/cover-*.jpg`) o pedírsela a Leo.

4. **Cargarla en la web.** En `mastering.html`, sumar una línea a la lista `MASTERS` del script:

   ```js
   { titulo:'Tema', artista:'Artista', sello:'Sello', tapa:'img/masters/archivo.jpg', link:'https://soundcloud.com/…' },
   ```

   Las tapas se muestran en blanco y negro y toman color al pasar el cursor (igual que en el resto de la web).

## Reglas del proyecto que aplican
- Siempre "PVR" (nunca "PBR").
- No subir a `main` sin que Leo diga "subilo".
- No mostrar temas viejos más tranceros de PVR: si un link parece de esa época, preguntar antes de cargarlo.
