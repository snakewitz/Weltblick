import json, os, sys, re, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harvest
Q = {
 'EG': ['Egypt road sign', 'Egypt license plate', 'Cairo street'],
 'AQ': ['Antarctica penguins station', 'McMurdo Station'],
 'PT-AZ': ['Azores road', 'Azores hydrangea road', 'São Miguel Azores street'],
 'BY': ['Minsk street sign', 'Belarus license plate', 'Minsk Holy Spirit Cathedral'],
 'IO': ['Diego Garcia', 'Chagos Archipelago beach'],
 'FK': ['Falkland Islands road', 'Stanley Falkland Islands street', 'Falkland Islands license plate'],
 'CC': ['Cocos Keeling Islands', 'West Island Cocos'],
 'UM-MQ': ['Midway Atoll albatross', 'Sand Island Midway'],
 'PN': ['Pitcairn Island Adamstown', 'Pitcairn Islands road'],
 'SJ': ['Longyearbyen road', 'Longyearbyen street', 'Svalbard license plate'],
 'GS': ['Grytviken', 'South Georgia King Edward Point'],
 'SZ': ['Eswatini road', 'Swaziland road', 'Eswatini license plate', 'Mbabane street'],
 'TZ': ['Tanzania road sign', 'Tanzania license plate', 'Gombe Stream National Park', 'Kilimanjaro Marangu route'],
 'CX': ['Christmas Island road', 'Christmas Island Flying Fish Cove'],
}
BAD = re.compile(r'\.(svg|gif|tif|tiff|pdf|djvu|webm|ogv|ogg|mp4|stl)$', re.I)
for code, qs in Q.items():
    fp = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cands', code + '.json')
    got, seen = [], set()
    for q in qs:
        d = harvest.api({'action': 'query', 'generator': 'search', 'gsrsearch': q, 'gsrnamespace': '6', 'gsrlimit': '12',
                         'prop': 'imageinfo', 'iiprop': 'url|extmetadata|size|mime', 'iiurlwidth': '330',
                         'iiextmetadatafilter': 'Artist|LicenseShortName|ImageDescription'})
        for p in sorted((d.get('query') or {}).get('pages') or [], key=lambda x: x.get('index', 0)):
            if p['title'] in seen or BAD.search(p['title']): continue
            ii = (p.get('imageinfo') or [{}])[0]
            if not ii.get('thumburl') or ii.get('mime') not in ('image/jpeg','image/png','image/webp') or ii.get('width',0) < 400: continue
            em = ii.get('extmetadata') or {}
            st = lambda v: html.unescape(re.sub(r'<[^>]+>', '', (em.get(v) or {}).get('value', ''))).strip()
            seen.add(p['title'])
            got.append({'title': p['title'], 'thumb': ii['thumburl'], 'url': ii.get('url'), 'page': ii.get('descriptionurl'),
                        'w': ii.get('width'), 'h': ii.get('height'), 'artist': st('Artist')[:120], 'license': st('LicenseShortName'), 'desc': '', 'cat': q})
    # in "schilder" ablegen (Landschaft/Allgemein), Kennzeichen separat
    kz = [g for g in got if re.search(r'plate|registration|kennzeichen', g['title'] + g['cat'], re.I)]
    rest = [g for g in got if g not in kz]
    json.dump({'kennzeichen': kz[:8], 'schilder': rest[:24]}, open(fp, 'w'), ensure_ascii=False)
    print(code, len(kz), len(rest), flush=True)
