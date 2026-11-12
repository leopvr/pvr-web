"""
Fondos propios para el collage de senal.html (blanco sobre negro, grano fino).
Todo se dibuja con código: puntos y líneas de 1 px acumulados, nada copiado de otras obras.

Uso:  python herramientas/fondos.py
Sale: img/fondo/fondo-01.jpg ... fondo-10.jpg  +  img/fondo/_hoja.jpg (hoja para elegir)
Cada fondo usa una semilla fija: si se vuelve a correr, salen iguales.
"""
import os, math
import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), '..', 'img', 'fondo')
SS = 2                      # se dibuja al doble y se reduce: líneas finas y suaves
BASE = 1400


def _caja(a, r, eje):
    r = max(1, int(r)); pad = [(0, 0), (0, 0)]; pad[eje] = (r+1, r)
    c = np.cumsum(np.pad(a, pad, mode='edge'), axis=eje, dtype=np.float64)
    if eje == 0: return ((c[2*r+1:] - c[:-2*r-1])/(2*r+1)).astype(np.float32)
    return ((c[:, 2*r+1:] - c[:, :-2*r-1])/(2*r+1)).astype(np.float32)


def blur(a, sigma):
    """Desenfoque casi gaussiano: tres pasadas de promedio en cada eje."""
    r = sigma*.87
    for _ in range(3):
        a = _caja(_caja(a, r, 0), r, 1)
    return a


class Lienzo:
    def __init__(self, w=BASE, h=BASE):
        self.w, self.h = w*SS, h*SS
        self.a = np.zeros((self.h, self.w), np.float32)

    def puntos(self, x, y, v=1.0):
        x = np.asarray(x); y = np.asarray(y)
        ok = (x >= 0) & (x < self.w) & (y >= 0) & (y < self.h)
        v = np.broadcast_to(np.asarray(v, np.float32), x.shape)[ok]
        np.add.at(self.a, (y[ok].astype(np.int32), x[ok].astype(np.int32)), v)

    def linea(self, x0, y0, x1, y1, v=1.0, paso=.6):
        n = max(2, int(math.hypot(x1-x0, y1-y0)/paso))
        t = np.linspace(0, 1, n)
        self.puntos(x0+(x1-x0)*t, y0+(y1-y0)*t, v)

    def curva(self, xs, ys, v=1.0, paso=.6):
        xs = np.asarray(xs, np.float32); ys = np.asarray(ys, np.float32)
        seg = np.hypot(np.diff(xs), np.diff(ys)); L = np.concatenate([[0], np.cumsum(seg)])
        t = np.linspace(0, L[-1], max(2, int(L[-1]/paso)))
        self.puntos(np.interp(t, L, xs), np.interp(t, L, ys), v)

    def brillo(self, radio, k):           # halo suave: blur del propio dibujo sumado
        self.a += blur(self.a, radio*SS)*k

    def guardar(self, nombre, pct=99.6, gamma=.8, grano=.045, rng=None, techo=.92):
        a = self.a / max(np.percentile(self.a[self.a > 0], pct) if (self.a > 0).any() else 1, 1e-6)
        a = np.clip(a, 0, 1)**gamma
        im = Image.fromarray((a*255).astype(np.uint8)).resize((self.w//SS, self.h//SS), Image.LANCZOS)
        b = np.asarray(im, np.float32)/255
        rng = rng or np.random.default_rng(0)
        b = b + (rng.random(b.shape, dtype=np.float32)-.5)*grano*(.3+.7*b)     # grano fino, más en las luces
        b = np.clip(b*techo, 0, 1)
        Image.fromarray((b*255).astype(np.uint8)).save(os.path.join(OUT, nombre), quality=82, optimize=True, progressive=True)
        return nombre


def ruido(h, w, escala, rng):
    """Ruido suave (valor interpolado) entre 0 y 1."""
    sh, sw = int(h/escala)+3, int(w/escala)+3
    small = Image.fromarray(rng.random((sh, sw)).astype(np.float32), 'F')
    big = small.resize((int(sw*escala), int(sh*escala)), Image.BICUBIC)
    return np.asarray(big, np.float32)[:h, :w]


def fbm(h, w, escala, rng, oct=4):
    s = np.zeros((h, w), np.float32); a = .5; tot = 0
    for _ in range(oct):
        s += a*ruido(h, w, escala, rng); tot += a; a *= .5; escala /= 2.03
    return s/tot


# ---------------------------------------------------------------- fondos
def eclipse(rng):
    c = Lienzo(); W, H = c.w, c.h; cx, cy, R = W/2, H/2, W*.3
    n = 900_000; side = np.where(rng.random(n) < .5, 1, -1); u = rng.random(n)
    g = rng.standard_normal(n)
    a = (rng.random(n)*2-1)*1.2
    th = np.cos(a/1.2*np.pi/2)**1.4*.15
    r = R*(1 - np.abs(g)*th*.55)
    x = cx + side*np.cos(a)*r; y = cy + np.sin(a)*r*1.12
    m = u > .7                                      # destellos horizontales
    t = rng.random(n)**1.8*.75*np.where(rng.random(n) < .5, 1, -1)
    x = np.where(m, cx + side*(R*.95 + t*R), x); y = np.where(m, cy + rng.standard_normal(n)*R*.012*(1-np.minimum(1, np.abs(t)/.75)), y)
    c.puntos(x, y, .7)
    for k in range(3):                               # aros de 1 px
        rr = R*(1.3+k*.18); tt = np.linspace(0, 2*np.pi, 20000)
        c.curva(cx+np.cos(tt)*rr, cy+np.sin(tt)*rr*1.12, .25)
    c.brillo(10, .25)
    return c.guardar('fondo-01.jpg', rng=rng)


def varillas(rng):
    c = Lienzo(1400, 1800); W, H = c.w, c.h; cx = W/2
    for i in range(52):
        a = rng.random()*2*np.pi; rr = .55+rng.random()*.45; frente = .25+.75*max(0, math.sin(a))
        top = H*.12 + rng.random()*H*.12; bot = H*.62 + rng.random()*H*.2
        xt = cx + math.cos(a)*rr*W*.18; xb = cx + math.cos(a)*rr*W*.42
        c.linea(xt, top, xb, bot, .9*frente)
        hk = 18*SS*np.sign(math.cos(a) or 1)                          # ganchito
        c.linea(xb, bot, xb+hk, bot+10*SS, .9*frente)
        c.puntos(np.full(40, xb)+rng.standard_normal(40)*2, np.full(40, bot)+rng.standard_normal(40)*2, .4*frente)
    c.brillo(14, .5)
    return c.guardar('fondo-02.jpg', rng=rng, pct=99.3)


def medio_tono(rng):
    c = Lienzo(); W, H = c.w, c.h; cell = 22
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = np.clip((xx/W*.7 + (1-yy/H)*.8) - .3, 0, 1)
    v = np.clip(v + (fbm(H, W, 500, rng)-.5)*.9, 0, 1)**1.4
    fx = (xx % cell) - cell/2; fy = (yy % cell) - cell/2
    d = np.sqrt(fx*fx + fy*fy)
    c.a = np.clip((v*cell*.48 - d)/1.5, 0, 1)*.9
    for _ in range(120):                                              # rayones
        x, y = rng.random()*W, rng.random()*H; ang = rng.random()*np.pi
        xs = [x]; ys = [y]
        for _ in range(60): ang += rng.normal(0, .25); x += math.cos(ang)*12; y += math.sin(ang)*12; xs.append(x); ys.append(y)
        c.curva(xs, ys, .2)
    return c.guardar('fondo-03.jpg', rng=rng, pct=99.9, gamma=1)


def ondas(rng):
    c = Lienzo(1400, 1800); W, H = c.w, c.h
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    n = fbm(H, W, 900, rng, 3)
    v = .5+.5*np.sin(yy/H*7.5 + n*5 + xx/W*1.5)
    v = np.clip((v-.45)*2.2, 0, 1)
    c.a = blur(v.astype(np.float32), 40*SS)*.85
    return c.guardar('fondo-04.jpg', rng=rng, pct=99.9, gamma=1.3, grano=.16)


def hilos(rng):
    c = Lienzo(1400, 1800); W, H = c.w, c.h
    centros = [W*.28, W*.5, W*.72]
    t = np.linspace(0, 1, 500)
    for i in range(2600):
        b = centros[i % 3]; x0 = b + rng.normal(0, W*.05); fase = rng.random()*6.28
        x = x0 + np.sin(t*np.pi*1.3 + fase*.15)*W*.16*np.sin(t*np.pi) + (W*.5 - b)*np.sin(t*np.pi)*.55 + rng.normal(0, 1)*t*W*.03
        y = H*.08 + t*H*.84
        c.curva(x, y, .12 + .1*rng.random())
    return c.guardar('fondo-05.jpg', rng=rng, pct=99.5)


def pinches(rng):
    c = Lienzo(); W, H = c.w, c.h
    n = 1_800_000
    x = rng.random(n)*W; y = rng.random(n)*H
    # campo de pirámides girado y en perspectiva
    ang = .6; xr = (x-W/2)*math.cos(ang) - (y-H/2)*math.sin(ang); yr = (x-W/2)*math.sin(ang) + (y-H/2)*math.cos(ang)
    persp = 1 + (yr/H + .5)*1.4; g = 260/persp
    fx = (xr/g) % 1 - .5; fy = (yr/g) % 1 - .5
    e = .02
    def hgt(px, py): return np.maximum(0, 1 - np.maximum(np.abs(px), np.abs(py))*2)**2
    hx = (hgt(fx+e, fy) - hgt(fx-e, fy))/(2*e); hy = (hgt(fx, fy+e) - hgt(fx, fy-e))/(2*e)
    nl = np.stack([-hx, -hy, np.ones_like(hx)]); nl /= np.linalg.norm(nl, axis=0)
    L = np.array([-.7, .6, .45]); L /= np.linalg.norm(L)
    br = np.clip((nl*L[:, None]).sum(0), 0, 1)**1.6
    keep = rng.random(n) < br*.9*np.clip(1.3-persp*.4, .2, 1)
    c.puntos(x[keep], y[keep], .8)
    return c.guardar('fondo-06.jpg', rng=rng, pct=99.7)


def orbitas(rng):
    c = Lienzo(1400, 1800); W, H = c.w, c.h
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    col = np.exp(-((xx-W/2)/(W*.11))**2) * (.35 + .65*np.exp(-((yy-H*.55)/(H*.5))**2))
    c.a = col*.35
    tt = np.linspace(0, 2*np.pi, 30000)
    c.curva(W/2+np.cos(tt)*W*.43, H*.33+np.sin(tt)*W*.43, .55)
    c.curva(W/2+np.cos(tt)*W*.25, H*.78+np.sin(tt)*W*.25, .4)
    for (x0, y0, x1, y1) in [(-.05, .15, 1.05, .82), (1.05, .15, -.05, .82), (0, .48, 1, .62), (1, .48, 0, .62)]:
        c.linea(x0*W, y0*H, x1*W, y1*H, .45)
    c.puntos(np.full(1, 0), np.full(1, 0), 0)
    a = c.a; r = (xx-W/2)**2 + (yy-H*.63)**2; a[r < (12*SS)**2] = 0     # el punto negro
    c.a = a
    return c.guardar('fondo-07.jpg', rng=rng, pct=99.8, grano=.12)


def esfera(rng):
    c = Lienzo(); W, H = c.w, c.h; cx, cy, R = W/2, H*.45, W*.34
    n = 1_400_000
    rr = np.sqrt(rng.random(n))*R; a = rng.random(n)*2*np.pi
    x = cx + np.cos(a)*rr; y = cy + np.sin(a)*rr
    nz = np.sqrt(np.clip(1-(rr/R)**2, 0, 1)); nx = (x-cx)/R; ny = (y-cy)/R
    lam = np.clip(-.55*nx - .6*ny + .58*nz, 0, 1); rim = (rr/R)**8
    keep = rng.random(n) < (lam*.75 + rim*.6)
    c.puntos(x[keep], y[keep], .7)
    for k in range(26):                                                 # rayos que bajan a un punto
        xa = W*(.08 + .84*k/25); c.linea(xa, H*.05, W/2, H*.93, .18)
    tt = np.linspace(0, 2*np.pi, 3000)
    for r0 in (14, 30, 52):
        c.curva(cx+np.cos(tt)*r0*SS, cy+np.sin(tt)*r0*SS, .5)
    c.brillo(8, .3)
    return c.guardar('fondo-08.jpg', rng=rng, pct=99.6)


def espinas(rng):
    c = Lienzo(1400, 1800); W, H = c.w, c.h
    t = np.linspace(0, 1, 900)
    xs = W*.5 + np.sin(t*5.5+.7)*W*.12 + np.sin(t*13)*W*.02; ys = H*.04 + t*H*.92
    for k in range(-9, 10):                                              # tallo con espesor
        c.curva(xs + k*1.6*SS*np.sin(t*3+1)**2, ys, .35)
    for i in rng.choice(len(t), 80, replace=False):
        ang = (rng.random()-.5)*1.2 + (0 if rng.random() < .5 else np.pi)
        L = (40 + rng.random()*150)*SS
        for k in range(14):                                              # espina que se afina
            w = (1-k/14)*5*SS
            c.linea(xs[i] + math.cos(ang)*L*k/14 - math.sin(ang)*rng.normal(0, w*.2),
                    ys[i] + math.sin(ang)*L*k/14, xs[i] + math.cos(ang)*L*(k+1)/14, ys[i] + math.sin(ang)*L*(k+1)/14, .25 + .5*(1-k/14))
    c.brillo(6, .35)
    return c.guardar('fondo-09.jpg', rng=rng, pct=99.2)


def marana(rng):
    c = Lienzo(); W, H = c.w, c.h
    for _ in range(340):
        x, y = W/2 + rng.normal(0, W*.18), H/2 + rng.normal(0, H*.2); ang = rng.random()*6.28; vx = vy = 0
        xs = []; ys = []
        for _ in range(700):
            ang += rng.normal(0, .18); dx, dy = W/2-x, H/2-y
            x += math.cos(ang)*5 + dx*.0012; y += math.sin(ang)*5 + dy*.0012 + 1.2
            xs.append(x); ys.append(y)
        c.curva(xs, ys, .09)
    return c.guardar('fondo-10.jpg', rng=rng, pct=99.6)


def hoja(nombres):
    """Hoja de opciones para elegir: miniaturas numeradas."""
    th = 320; cols = 5; rows = math.ceil(len(nombres)/cols); pad = 16
    sheet = Image.new('L', (cols*(th+pad)+pad, rows*(int(th*1.29)+pad+28)+pad), 0)
    d = ImageDraw.Draw(sheet)
    try: font = ImageFont.truetype('consola.ttf', 16)
    except Exception: font = ImageFont.load_default()
    for i, n in enumerate(nombres):
        im = Image.open(os.path.join(OUT, n)).convert('L'); im.thumbnail((th, int(th*1.29)))
        x = pad + (i % cols)*(th+pad); y = pad + (i//cols)*(int(th*1.29)+pad+28)
        sheet.paste(im, (x, y)); d.text((x, y+int(th*1.29)+6), n.replace('.jpg', ''), fill=200, font=font)
    sheet.save(os.path.join(OUT, '_hoja.jpg'), quality=85)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    hechos = []
    for i, f in enumerate([eclipse, varillas, medio_tono, ondas, hilos, pinches, orbitas, esfera, espinas, marana]):
        hechos.append(f(np.random.default_rng(1000+i))); print('listo', hechos[-1])
    hoja(hechos); print('hoja lista')
