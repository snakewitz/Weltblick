"""Sammelt Kandidaten-Fotos von Wikimedia Commons je Land und Thema.
Höflich: ~1 Anfrage / 2,2 s, Backoff bei 429, Antworten werden gecacht."""
import json, os, sys, time, hashlib, urllib.parse, urllib.request, re, html

S = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(S, 'cache'); os.makedirs(CACHE, exist_ok=True)
OUT = os.path.join(S, 'cands'); os.makedirs(OUT, exist_ok=True)
UA = 'GeoArcade-LearningMap/1.0 (educational, low-volume)'
API = 'https://commons.wikimedia.org/w/api.php'
last = [0.0]
PACE = [1.0]   # angemeldet: 1 Anfrage pro Sekunde

def api(params):
    params = dict(params, format='json', formatversion='2', maxlag='5')
    q = urllib.parse.urlencode(params)
    key = hashlib.md5(q.encode()).hexdigest()
    fp = os.path.join(CACHE, key + '.json')
    if os.path.exists(fp):
        return json.load(open(fp))
    for attempt in range(8):
        wait = PACE[0] - (time.time() - last[0])
        if wait > 0: time.sleep(wait)
        last[0] = time.time()
        try:
            req = urllib.request.Request(API + '?' + q, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                data = json.loads(r.read().decode())
            if 'error' in data and data['error'].get('code') == 'maxlag':
                time.sleep(10); continue
            json.dump(data, open(fp, 'w'))
            PACE[0] = max(1.0, PACE[0] * 0.95)
            return data
        except urllib.error.HTTPError as e:
            if e.code == 429:
                ra = e.headers.get('Retry-After')
                PACE[0] = min(30.0, PACE[0] * 1.3)
                time.sleep(max(float(ra) if ra and ra.isdigit() else 0, 15 * (attempt + 1))); continue
            time.sleep(5)
        except Exception:
            time.sleep(5)
    return {}

TOPICS = {
    'poller': ['Delineators in {}', 'Road delineators in {}', 'Guide posts in {}', 'Bollards in {}'],
    'kennzeichen': ['License plates of {}', 'Vehicle registration plates of {}'],
    'masten': ['Utility poles in {}', 'Electricity poles in {}', 'Wooden utility poles in {}', 'Concrete utility poles in {}', 'Power poles in {}'],
    'schilder': ['Chevron alignment signs in {}', 'Direction signs in {}', 'Kilometre posts in {}', 'Milestones in {}', 'Place-name signs in {}', 'Street signs in {}', 'Road signs in {}'],
    'markierungen': ['Road markings in {}', 'Road surface markings in {}'],
}
BAD = re.compile(r'\.(svg|gif|tif|tiff|pdf|djvu|webm|ogv|ogg|mp4|stl)$', re.I)

def members(cat, limit=60):
    """Dateien einer Kategorie mit Bild-Infos (ein Aufruf). Liefert auch Unterkategorien."""
    d = api({'action': 'query', 'generator': 'categorymembers', 'gcmtitle': 'Category:' + cat,
             'gcmtype': 'file|subcat', 'gcmlimit': str(limit), 'prop': 'imageinfo',
             'iiprop': 'url|extmetadata|size|mime', 'iiurlwidth': '330',
             'iiextmetadatafilter': 'Artist|LicenseShortName|ImageDescription'})
    pages = (d.get('query') or {}).get('pages') or []
    files, subs = [], []
    for p in pages:
        if p.get('ns') == 14: subs.append(p['title'][9:]); continue
        if p.get('ns') != 6 or BAD.search(p['title']): continue
        ii = (p.get('imageinfo') or [{}])[0]
        if not ii.get('thumburl') or ii.get('mime') not in ('image/jpeg', 'image/png', 'image/webp'): continue
        if ii.get('width', 0) < 400: continue
        em = ii.get('extmetadata') or {}
        strip = lambda v: html.unescape(re.sub(r'<[^>]+>', '', (em.get(v) or {}).get('value', ''))).strip()
        files.append({'title': p['title'], 'thumb': ii['thumburl'], 'url': ii.get('url'), 'page': ii.get('descriptionurl'),
                      'w': ii.get('width'), 'h': ii.get('height'), 'artist': strip('Artist')[:120],
                      'license': strip('LicenseShortName'), 'desc': strip('ImageDescription')[:200], 'cat': cat})
    return files, subs

EXIST = {}
def check_categories(names):
    titles = sorted({'Category:' + p.format(n['en']) for n in names.values() for pats in TOPICS.values() for p in pats})
    fp = os.path.join(S, 'catinfo.json')
    if os.path.exists(fp): EXIST.update(json.load(open(fp)))
    todo = [t for t in titles if t not in EXIST]
    for i in range(0, len(todo), 50):
        chunk = todo[i:i + 50]
        d = api({'action': 'query', 'titles': '|'.join(chunk), 'prop': 'categoryinfo'})
        if not d.get('query'):
            print('catinfo Anfrage fehlgeschlagen, später erneut', flush=True); continue
        norm = {x['from']: x['to'] for x in (d.get('query') or {}).get('normalized', [])}
        info = {}
        for p in (d.get('query') or {}).get('pages', []):
            ci = p.get('categoryinfo') or {}
            info[p['title']] = 0 if p.get('missing') else (ci.get('files', 0) + ci.get('subcats', 0))
        for t in chunk:
            EXIST[t] = info.get(norm.get(t, t), 0)
        json.dump(EXIST, open(fp, 'w'))
        print('catinfo', i + len(chunk), '/', len(todo), flush=True)

def harvest(code, en):
    fp = os.path.join(OUT, code + '.json')
    if os.path.exists(fp): return
    res = {}
    for topic, pats in TOPICS.items():
        got, seen = [], set()
        for pat in pats:
            if len(got) >= 14: break
            cat = pat.format(en)
            if not EXIST.get('Category:' + cat): continue
            files, subs = members(cat)
            for f in files:
                if f['title'] not in seen: seen.add(f['title']); got.append(f)
            # eine Ebene Unterkategorien (begrenzt)
            for sub in subs[:4]:
                if len(got) >= 14: break
                if re.search(r' by |people|interior|logo', sub, re.I): continue
                f2, _ = members(sub, 30)
                for f in f2:
                    if f['title'] not in seen: seen.add(f['title']); got.append(f)
        res[topic] = got[:14]
    json.dump(res, open(fp, 'w'), ensure_ascii=False)
    print(code, {k: len(v) for k, v in res.items()}, flush=True)

if __name__ == '__main__':
    names = json.load(open(os.path.join(S, 'countries_en.json')))
    check_categories(names)
    print('existing categories:', sum(1 for v in EXIST.values() if v), flush=True)
    order = sys.argv[1:] or list(names)
    for c in order:
        try: harvest(c, names[c]['en'])
        except Exception as e: print('ERR', c, e, flush=True)
    print('DONE', flush=True)
