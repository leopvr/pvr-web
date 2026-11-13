"""Baja la tapa (artwork) de un link de SoundCloud y devuelve sus datos en JSON.

Uso:
  python -I tapa.py <link de soundcloud> [--out img/masters] [--nombre archivo] [--grande]

- Limpia el link (saca ?si=, utm_ y demás rastreo).
- Pide los datos a SoundCloud por oEmbed (público, sin cuenta).
- Baja la tapa en 500x500 (con --grande intenta la original y si no existe usa 500x500).
- Imprime JSON: link limpio, título, artista/sello, título sugerido, archivo guardado.
Solo usa la biblioteca estándar de Python.
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

UA = 'Mozilla/5.0 (compatible; tapa-script/1.0)'


def limpiar(url):
    url = url.strip()
    if not re.match(r'^https?://', url):
        url = 'https://' + url
    p = urllib.parse.urlsplit(url)
    host = p.netloc.lower()
    if host.startswith('m.'):
        host = host[2:]
    if host not in ('soundcloud.com', 'www.soundcloud.com', 'on.soundcloud.com'):
        raise SystemExit('No es un link de SoundCloud: ' + url)
    return urllib.parse.urlunsplit(('https', host, p.path.rstrip('/'), '', ''))


def pedir(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read(), r.geturl()


def slug(texto):
    t = texto.lower()
    for a, b in (('á', 'a'), ('é', 'e'), ('í', 'i'), ('ó', 'o'), ('ú', 'u'), ('ñ', 'n'), ('ü', 'u')):
        t = t.replace(a, b)
    t = re.sub(r'[^a-z0-9]+', '-', t).strip('-')
    return t[:60] or 'tapa'


def main():
    args = sys.argv[1:]
    if not args:
        raise SystemExit(__doc__)
    url, out, nombre, grande = None, 'img/masters', None, False
    i = 0
    while i < len(args):
        a = args[i]
        if a == '--out':
            out = args[i + 1]; i += 2; continue
        if a == '--nombre':
            nombre = args[i + 1]; i += 2; continue
        if a == '--grande':
            grande = True; i += 1; continue
        url = a; i += 1
    link = limpiar(url)
    # los links cortos (on.soundcloud.com) redirigen al link real
    if link.startswith('https://on.soundcloud.com'):
        _, real = pedir(link)
        link = limpiar(real)

    data, _ = pedir('https://soundcloud.com/oembed?format=json&url=' + urllib.parse.quote(link, safe=''))
    info = json.loads(data.decode('utf-8'))
    titulo = (info.get('title') or '').strip()
    autor = (info.get('author_name') or '').strip()
    # SoundCloud agrega " by <cuenta>" al final del título
    limpio = re.sub(r'\s+by\s+' + re.escape(autor) + r'\s*$', '', titulo, flags=re.I) if autor else titulo
    limpio = re.sub(r'\s*[\(\[](free\s*download|free\s*dl|out\s*now|premiere)[^\)\]]*[\)\]]', '', limpio, flags=re.I)
    limpio = re.sub(r'^\s*(premiere|estreno|exclusive)\s*[:\-–]\s*', '', limpio, flags=re.I)
    limpio = re.sub(r'\s*\(original mix\)', '', limpio, flags=re.I)
    limpio = re.sub(r'\s{2,}', ' ', limpio).strip()
    artista, tema = '', limpio
    m = re.match(r'^(.+?)\s+[-–—]\s+(.+)$', limpio)
    if m:
        artista, tema = m.group(1).strip(), m.group(2).strip()

    thumb = info.get('thumbnail_url') or ''
    if not thumb:
        raise SystemExit('SoundCloud no devolvió tapa para ' + link)
    candidatos = [thumb]
    if grande:
        candidatos.insert(0, re.sub(r'-(t\d+x\d+|large|crop)\.', '-original.', thumb))
    os.makedirs(out, exist_ok=True)
    base = nombre or slug(((artista + ' ') if artista else '') + tema)
    guardado, error = None, None
    for c in candidatos:
        try:
            img, _ = pedir(c)
        except Exception as e:  # la original a veces no existe
            error = e
            continue
        ext = '.png' if img[:8] == b'\x89PNG\r\n\x1a\n' else '.jpg'
        guardado = os.path.join(out, base + ext).replace('\\', '/')
        with open(guardado, 'wb') as f:
            f.write(img)
        break
    if not guardado:
        raise SystemExit('No se pudo bajar la tapa: %s' % error)

    print(json.dumps({
        'link': link,
        'titulo_soundcloud': titulo,
        'cuenta': autor,
        'artista': artista,
        'tema': tema,
        'es_lista': '/sets/' in link,
        'tapa': guardado,
        'tamano_bytes': os.path.getsize(guardado),
        # las listas sin tapa propia devuelven el logo gris de SoundCloud (un archivo chiquito): no usarlo
        'posible_placeholder': os.path.getsize(guardado) < 6000,
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
