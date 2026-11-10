#!/usr/bin/env python3
"""Pasa una foto al blanco y negro de PVR (contraste alto + grano) y la recorta.

Uso:
  python3 foto_bn.py ENTRADA SALIDA --ratio 4:5 --ancho 1100 [--cx 0.5 --cy 0.4] [--gamma 1.06]

  --ratio   proporción del recorte: 4:5 (retrato), 21:9 (tarjeta ancha), 16:9, 9:16, 1:1
  --ancho   ancho final en píxeles
  --cx/--cy centro del recorte (0 a 1). cy 0.4 = un poco arriba del medio, bueno para caras
  --gamma   >1 oscurece los medios tonos, <1 los aclara

Necesita: pip install pillow numpy
"""
import argparse
import numpy as np
from PIL import Image

def bn(im, mezcla=(.45, .42, .13), gamma=1.06, grano=.035, semilla=4):
    a = np.asarray(im.convert("RGB")).astype(np.float32) / 255
    l = mezcla[0]*a[..., 0] + mezcla[1]*a[..., 1] + mezcla[2]*a[..., 2]
    lo, hi = np.percentile(l, .8), np.percentile(l, 99.7)
    l = np.clip((l - lo) / (hi - lo), 0, 1) ** gamma
    rng = np.random.default_rng(semilla)
    l = np.clip(l + rng.normal(0, grano, l.shape) * (0.6 + 0.4*(1 - l)), 0, 1)
    return Image.fromarray((l*255).astype(np.uint8))

def recortar(im, ratio, cx=.5, cy=.4):
    w, h = im.size
    cw, ch = (int(h*ratio), h) if w/h > ratio else (w, int(w/ratio))
    x = int(min(max(cx*w - cw/2, 0), w - cw))
    y = int(min(max(cy*h - ch/2, 0), h - ch))
    return im.crop((x, y, x + cw, y + ch))

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("entrada"); p.add_argument("salida")
    p.add_argument("--ratio", default="4:5"); p.add_argument("--ancho", type=int, default=1100)
    p.add_argument("--cx", type=float, default=.5); p.add_argument("--cy", type=float, default=.4)
    p.add_argument("--gamma", type=float, default=1.06)
    a = p.parse_args()
    rw, rh = (float(x) for x in a.ratio.split(":"))
    im = bn(recortar(Image.open(a.entrada), rw/rh, a.cx, a.cy), gamma=a.gamma)
    im = im.resize((a.ancho, round(a.ancho*rh/rw)), Image.LANCZOS)
    im.save(a.salida, quality=82, optimize=True, progressive=True)
    print(a.salida, im.size)
