# CLAUDE.md — Web de PVR (pvrstudio.com)

Leé esto antes de tocar nada. Hablá siempre en español rioplatense.

## Quién es
- **PVR** = Leonardo Peñalver, DJ y productor de Buenos Aires. Siempre **PVR**, en mayúsculas y con **V** (nunca "PBR"). No explicar de dónde sale el nombre.
- Residente de **BeTechno** (también su management). Lleva **5 años** en cabina.
- Profesor de producción y mezcla hace 4 años y, actualmente, director del área de producción musical de **Tekgen**.
- Sonido: techno industrial oscuro, intenso, con texturas, distorsión, ambientes y momentos introspectivos. "Una catarsis del lado oscuro".
- Tocó en BeTechno, Tekgen, TEKNA 303, Arzaffel, Heiss y RAVE 3000. Compartió cabina con Rebekaos, Alexunder, HRDDMAT y KUCKI (en la web ya no hay fila "Compartió cabina").

## Cómo trabajamos
- **Primero en local, después online.** Los cambios se hacen en la rama `borrador` (o en local) y se muestran. Solo se pasan a `main` (= online) cuando Leo dice "subilo".
- Antes de cambiar fotos o videos, mostrar **opciones** (una hoja con varias alternativas) y que elija él.
- Mensajes de commit en español, cortos y claros (ej. "Docencia: nueva foto y texto").

## Publicar
- Repo: `leopvr/pvr-web`. Cloudflare (Worker con assets estáticos) publica cada push a `main` en https://pvrstudio.com (también www y https://pvr-web.leo-pvr13.workers.dev/).
- Sin build: es HTML estático. `.assetsignore` deja afuera CLAUDE.md, README, herramientas.
- Ver local: `python3 -m http.server 8000` → http://localhost:8000
- Pasar borrador a online: `git checkout main && git merge borrador && git push` (solo con OK de Leo).
- `v1.html` — la web anterior (V1), guardada como referencia.

## Versiones
- El commit que se sube a online se llama `pvrstudio vX.Y.Z` y lleva una etiqueta `vX.Y.Z`.
  - X = versión de la web (2 = la actual en 3D) · Y = actualizaciones grandes · Z = cambios chicos o arreglos de bugs.
- Última subida: **pvrstudio v2.0.0** (presskit V2 + páginas Mezcla y mastering y Clases + paso entre páginas).

## Estructura
- `index.html` — el presskit (V2: escena 3D en WebGL con three.js, cadenas, niebla, PVR en hilos), con CSS y JS adentro. Secciones en orden:
  `#inicio` (portada con video) → Manifiesto (video de fondo) → `#sobre` → `#en-la-pista` (4 videos cortos) → `#sonido` (filas corridas INTENSO / TEXTURAS / CATARSIS…) → `#trayectoria` → `#musica` (lanzamientos) → `#sets` (Black Room Radio destacado + ASFIXIA + Droxcast) → `#docencia` → `#rider` (dibujo SVG propio de 3 CDJ + mixer) → `#booking`.
- Páginas secundarias (en el menú como "02 Mastering" y "03 Clases"; en la portada solo links discretos y el bloque "Además" antes del pie):
  - `mastering.html` — Mezcla y mastering: Master / Master por stems / Mezcla + master, lanzamientos masterizados (lista `MASTERS` en el script; tapas en `img/masters/`: Henri Piper, Inerte, Loza Industrial; para sumar uno usar la skill `soundcloud-tapa` en `.claude/skills/`) y formulario a contact.leopvr@gmail.com por FormSubmit.
  - `clases.html` — Clases de producción en TEKGEN, con mensaje precargado y redes (objeto `TEKGEN` en el script): Instagram https://www.instagram.com/tekgen_ · WhatsApp +54 9 11 6795-9065 · sin TikTok. Logo: `img/tekgen-logo.png` (blanco, achicado del original en `../Tekgen logos/`).
  - `escena-secundaria.js` — 3D de las secundarias: los fondos generados (`img/fondo/`) recortados sin fondo, grandes y difuminados, con partículas finas, dibujados detrás del humo (`#art` abajo, `#amb` arriba y transparente), que se desprenden por los bordes y se deshacen con el cursor, y cadenas con espinas colgando. Se ubican con huecos `<div class="art" data-art="fondo" data-src="…">` / `data-art="cadena"`. (Los artefactos de cromo se probaron y no gustaron.)
  - `secundaria.css` = base de esas dos páginas. `dimension.js` + `dimension.css` = paso entre páginas: se desvanece en partículas y humo, 3 variantes (Ceniza / Niebla / Grano; en local aparece un selector abajo a la izquierda, la elegida se guarda en el navegador) y fondo de humo de las secundarias; se usa en las tres. Un link cruza de página con el efecto si tiene `data-dim`.
- `img/` — fotos procesadas. `og.jpg` = imagen al compartir el link.
- `video/` — loops `.mp4` (8 s, B&N, sin audio) + imagen de espera `.jpg` con el mismo nombre.
  - Portada: `hero.mp4` (compu, elegido "H2": primer plano en cabina con la cara iluminada) y `hero-v.mp4` (celular, "V5": láseres sobre el público). El JS elige según orientación (`data-land` / `data-port`).
  - Los videos se cargan solos al acercarse (IntersectionObserver) para que la página sea liviana.
- `borradores/consola.html` — versión alternativa "consola": menú lateral, control de Distorsión, botón Negativo, sección **Mezcla y mastering** con formulario. El formulario manda a contact.leopvr@gmail.com por FormSubmit (la primera vez que se use online llega un mail de activación que Leo tiene que confirmar). No está enlazada desde la web.
- `herramientas/foto_bn.py` y `herramientas/video_loop.sh` — recetas para preparar fotos y videos con la estética.

## Estética (no negociable)
- Blanco y negro, grano, contraste alto, glitch de textura, strobe. Moderno pero crudo.
- Fondo casi negro `#060606`, texto `#efeeea`. Tipografías: **Inter Tight** (300/400/600/800) y **JetBrains Mono** para etiquetas.
- Fotos: siempre pasarlas por `foto_bn.py`. Nunca poner glitch sobre la cara.
- Videos: siempre en B&N con `video_loop.sh` (ffmpeg, H.264 veryfast CRF 27, faststart).
- Respetar `prefers-reduced-motion` (ya hay una regla que frena animaciones).
- Favicon: punto negro (`favicon.svg` / `favicon.png`).
- No reproducir el diseño exacto de equipos de marca (Pioneer) ni logos ajenos: dibujos propios.
- No mostrar sus temas viejos más tranceros.

## Datos y links
- Booking: contact.leopvr@gmail.com · BeTechno: betechnocommunity@gmail.com
- Instagram: https://www.instagram.com/pvr__________ (son 10 guiones bajos; copiar, no tipear)
- SoundCloud: https://soundcloud.com/pvr_trax · Spotify: https://open.spotify.com/artist/4VE9PU7va4gBisff4hAZGF · YouTube: https://www.youtube.com/@pvr_tracks
- Último set: "PVR - DJ Set at Black Room Radio" https://youtu.be/zJYam65M9F0
- Presskit (Drive, link "PVR Presskit" en Booking): https://drive.google.com/drive/u/4/folders/1McOlb39oepg8M8IJdTcWV4rKYDw8wyVy
- Rider: 3 × CDJ-3000 · 1 × DJM-A9
- Lanzamientos: Todo es temporal (álbum, BeTechno), Tercer Mandamiento (Introspicere), Pure Hell (EP, VAST Perception), Sleep Anxiety (COUP), Mind Your Own Business (Paranoid), Inerte ft. Mar de los Ángeles, INCÓGNITA.

## Pendiente / ideas en curso
1. **Reestructura del sitio** (sin empezar, faltan respuestas de Leo):
   - Entrada con presentación y dos puertas: **PVR** (artista) y **Studio** (mezcla y mastering, separado).
   - Galería **Visual** (fotos + videos artísticos).
   - **Cabina**: sección interactiva para mezclar sus tracks en CDJs. Leo va a pasar una página de referencia: tomar la idea, hacer diseño propio, no copiar.
   - **Redes**: embeds de Spotify / SoundCloud, Instagram, YouTube.
   - Preguntas abiertas: prioridad del visitante, intro animada o portada fija, estética (consola / original / mezcla), precios y tiempos del Studio (cantidad de revisiones, formatos).
2. **Sistema de fechas**: Leo pasa link + flyer de cada fecha y se agrega a la web (sección de próximas fechas, fácil de actualizar).
3. A futuro: contenido de producción y un apartado de clases.
