"""Baut je Land eine Kontakt-Tafel aus den Kandidaten-Fotos (zur Sichtprüfung)."""
import json, os, sys, time, hashlib, urllib.request, io
from PIL import Image, ImageDraw, ImageFont

S = os.path.dirname(os.path.abspath(__file__))
TH = os.path.join(S, 'thumbs'); os.makedirs(TH, exist_ok=True)
SH = os.path.join(S, 'sheets'); os.makedirs(SH, exist_ok=True)
UA = 'GeoArcade-LearningMap/1.0 (educational, low-volume)'
TOP = ['poller', 'kennzeichen', 'masten', 'schilder', 'markierungen']
ABBR = {'poller': 'P', 'kennzeichen': 'K', 'masten': 'M', 'schilder': 'S', 'markierungen': 'R'}
last = [0.0]

def thumb(url):
    fp = os.path.join(TH, hashlib.md5(url.encode()).hexdigest() + '.jpg')
    if os.path.exists(fp):
        try: return Image.open(fp).convert('RGB')
        except Exception: pass
    for attempt in range(5):
        wait = 1.0 - (time.time() - last[0])
        if wait > 0: time.sleep(wait)
        last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=40) as r: data = r.read()
            im = Image.open(io.BytesIO(data)).convert('RGB')
            im.thumbnail((330, 330)); im.save(fp, quality=85)
            return im
        except urllib.error.HTTPError as e:
            if e.code == 429:
                ra = e.headers.get('Retry-After'); time.sleep(max(float(ra) if ra and ra.isdigit() else 0, 10 * (attempt + 1))); continue
            return None
        except Exception:
            time.sleep(3)
    return None

def font(sz):
    for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf']:
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()

def build(code, per=8):
    c = json.load(open(os.path.join(S, 'cands', code + '.json')))
    cell, pad = 200, 6
    rows = [(t, c.get(t, [])[:per]) for t in TOP if c.get(t)]
    if not rows: return None
    W = 90 + per * (cell + pad); H = sum(cell + 34 for _ in rows) + 10
    sheet = Image.new('RGB', (W, H), (20, 18, 40)); d = ImageDraw.Draw(sheet)
    f, fs = font(22), font(13)
    y = 6
    for t, items in rows:
        d.text((8, y + cell // 2 - 12), ABBR[t], fill=(255, 212, 0), font=font(40))
        for i, it in enumerate(items):
            im = thumb(it['thumb'])
            x = 90 + i * (cell + pad)
            if im:
                im = im.copy(); im.thumbnail((cell, cell))
                sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2))
            d.rectangle([x, y, x + 34, y + 26], fill=(0, 0, 0)); d.text((x + 4, y + 2), f'{ABBR[t]}{i}', fill=(0, 229, 255), font=f)
            d.text((x, y + cell + 2), it['title'][5:38], fill=(200, 200, 220), font=fs)
        y += cell + 34
    out = os.path.join(SH, code + '.jpg'); sheet.save(out, quality=82)
    return out

if __name__ == '__main__':
    for code in sys.argv[1:]:
        print(code, build(code), flush=True)
