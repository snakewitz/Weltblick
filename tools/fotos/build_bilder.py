"""Erzeugt data/bilder.js aus der Handauswahl (picks.json) und den Kandidaten (cands/*.json)."""
import json, os, re

S = os.path.dirname(os.path.abspath(__file__))
OUT = '/home/user/weltblick/data/bilder.js'
TOPIC = {'P': 'poller', 'K': 'kennzeichen', 'M': 'masten', 'S': 'schilder', 'R': 'markierungen', 'L': 'landschaft'}

def clean(u):
    return re.sub(r'\?utm_[^#]*$', '', u or '')

def big_url(c):
    th = clean(c['thumb'])
    if c.get('w', 0) > 1280 and '/330px-' in th:
        return th.replace('/330px-', '/1280px-')
    return clean(c.get('url')) or th

picks = json.load(open(os.path.join(S, 'picks.json')))
res = {}
for code, sel in picks.items():
    cands = json.load(open(os.path.join(S, 'cands', code + '.json')))
    for ref, cap in sel.items():
        topic = TOPIC[ref[0]]; idx = int(ref[1:])
        c = cands[topic][idx]
        lic = c.get('license') or ''
        if not re.search(r'CC|Public domain|PD|GFDL|Attribution|FAL|Free Art', lic, re.I):
            print('WARN Lizenz unklar', code, ref, lic)
        res.setdefault(code, {}).setdefault(topic, []).append({
            'th': clean(c['thumb']), 'big': big_url(c), 'cap': cap,
            'by': re.sub(r'\s+', ' ', c.get('artist') or 'unbekannt')[:80],
            'lic': lic, 'src': c.get('page') or '',
        })

with open(OUT, 'w') as f:
    f.write('// Fotos von Wikimedia Commons (freie Lizenzen, Fotograf und Lizenz je Bild angegeben).\n')
    f.write('// Von Hand ausgewählt und beschriftet; erzeugt mit build_bilder.py\n')
    f.write('window.BILDER = ' + json.dumps(res, ensure_ascii=False, indent=0) + ';\n')
print('Länder:', len(res), 'Fotos:', sum(len(v) for t in res.values() for v in t.values()))
