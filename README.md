# PVR — web

Sitio de PVR (Leonardo Peñalver), DJ y productor. Publicado en https://pvrstudio.com.

## Cómo está armado
- `index.html` — toda la página (estilos y scripts adentro del mismo archivo).
- `img/` — fotos ya procesadas (blanco y negro con grano) y tapas de lanzamientos.
- `video/` — loops de video en blanco y negro (`.mp4`) con su imagen de espera (`.jpg`).
- `borradores/consola.html` — versión alternativa "consola" (con formulario de mezcla y mastering). No está enlazada desde la web.
- `herramientas/` — scripts para preparar fotos y videos.
- `CLAUDE.md` — contexto del proyecto para Claude Code.

## Ver la web en tu compu
```
python3 -m http.server 8000
```
y abrí http://localhost:8000 (la versión consola está en http://localhost:8000/borradores/consola.html).

## Publicar
- Rama `main` = lo que está online. Cada push a `main` lo publica Cloudflare en uno o dos minutos.
- Rama `borrador` = cambios en prueba. Cuando estén aprobados se pasan a `main`.
