#!/usr/bin/env bash
# Hace un loop de video en blanco y negro para la web (sin audio) + su imagen de espera.
#
# Uso:  ./video_loop.sh ENTRADA SALIDA.mp4 INICIO DURACION [h|v]
#   INICIO   segundo desde donde cortar (ej. 11)
#   DURACION segundos del loop (en la web usamos 8)
#   h = horizontal 1280x720 (compu) · v = vertical 720x1280 (celular)
#
# Ejemplo (portada actual, H2):  ./video_loop.sh MVI_4784.MOV ../video/hero.mp4 11 8 h
# Necesita ffmpeg.
set -e
IN="$1"; OUT="$2"; SS="$3"; DUR="$4"; ORI="${5:-h}"
if [ "$ORI" = "v" ]; then W=720; H=1280; else W=1280; H=720; fi
FO=$(python3 -c "print($DUR-0.4)")
ffmpeg -y -ss "$SS" -t "$DUR" -i "$IN" -an \
  -vf "scale=$W:$H:force_original_aspect_ratio=increase,crop=$W:$H,hue=s=0,eq=contrast=1.18:brightness=0.02:gamma=0.95,fade=t=in:st=0:d=0.4,fade=t=out:st=$FO:d=0.4" \
  -c:v libx264 -preset veryfast -crf 27 -pix_fmt yuv420p -movflags +faststart "$OUT"
# Imagen de espera (primer cuadro nítido) con el mismo nombre en .jpg
ffmpeg -y -ss 0.6 -i "$OUT" -frames:v 1 -q:v 4 "${OUT%.mp4}.jpg"
echo "Listo: $OUT y ${OUT%.mp4}.jpg"
