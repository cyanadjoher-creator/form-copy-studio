"""Capture Master Tracker -> Copy Studio import rows (JSON). Vocabulary mapping is done after, in Node, with the site's own code."""
import openpyxl, json, re, sys
wb = openpyxl.load_workbook(sys.argv[1])
ws = wb['Master Tracker']; H = [c.value for c in ws[1]]
rows = [r for r in ws.iter_rows(min_row=2, values_only=True) if any(r)]
col = lambda r, n: r[H.index(n)]
ctx = {}
if 'Copy Context' in wb.sheetnames:
    cc = list(wb['Copy Context'].iter_rows(values_only=True)); ch = cc[0]
    for r in cc[1:]:
        if r and r[ch.index('Temp ID')]: ctx[str(r[ch.index('Temp ID')]).strip()] = dict(zip(ch, r))

CATS = [  # order matters: first hit wins
    (r'\bbelt\b', 'Belts'), (r'\btote|bag|clutch|pouch\b', 'Bags'), (r'\bboots?\b', 'Boots'),
    (r'\btwinset\b|\bset\b', 'Sets'), (r'\bjumpsuit|overalls|dungarees\b', 'Jumpsuits'),
    (r'\bdress\b', 'Dresses'), (r'\bskirt\b', 'Skirts'), (r'\bcapris?\b|\btrousers\b|\bpants\b', 'Trousers'), (r'\bjeans\b', 'Jeans'), (r'\bshorts\b', 'Shorts'),
    (r'\bcardigan\b', 'Cardigans'), (r'\bjumper|sweater\b', 'Jumpers'), (r'\bhoodie|sweatshirt\b', 'Hoodies & Sweatshirts'),
    (r'\bblazer\b', 'Blazers'), (r'\bparka|coat\b', 'Coats'), (r'\bgilet|vest|waistcoat\b', 'Waistcoats'), (r'\bjacket|bomber\b', 'Jackets'),
    (r'\bt-shirt|tee\b', 'T-shirts'), (r'\btank top\b', 'Tank tops'), (r'\bblouse\b', 'Blouses'), (r'\bshirt\b', 'Shirts'), (r'\btop\b|\bcorset\b', 'Tops'),
    (r'\bboots?\b', 'Boots'), (r'\bshoes|heels|loafers|sandals|sneakers|trainers|mules|pumps\b', 'Shoes'),
    (r'\bbelt\b', 'Belts'), (r'\btote|bag|clutch|pouch\b', 'Bags'), (r'\bhat|cap\b', 'Hats'), (r'\bscarf\b', 'Scarves'), (r'\bgloves\b', 'Gloves'),
    (r'\bring\b', 'Rings'), (r'\bbracelet|bangle\b', 'Bracelets'), (r'\bearrings?\b', 'Earrings'), (r'\bnecklace|pendant\b', 'Necklaces'), (r'\bsunglasses|glasses\b', 'Sunglasses'),
]
def category(*texts):
    for t in texts:
        t = (t or '').lower()
        for rx, c in CATS:
            if re.search(rx, t): return c
    return ''

def season(title_season, original):
    if title_season: return title_season
    s = original or ''
    m = re.search(r'\b(S/S|SS|A/W|AW|F/W|FW)\s?(\d{2,4})\b', s, re.I)
    if m:
        y = m.group(2); y = y if len(y) == 4 else ('19' + y if int(y) > 40 else '20' + y)
        return ('Spring/Summer ' if m.group(1).upper().startswith('S') else 'Fall/Winter ') + y
    m = re.search(r'\b((?:19|20)\d0s)\b', s)
    return m.group(1) if m else ''

def text(v): return re.sub(r'[ \t]+', ' ', str(v or '')).strip()

def measurements(desc, gina):
    d = str(desc or '')
    out = []
    # Option layout: "Label : 38 cm", with optional (Jacket)/(Pants) section titles
    sec = ''
    for line in d.split('\n'):
        l = line.strip()
        m = re.match(r'Measurements\s*\(([^)]+)\)', l, re.I)
        if m: sec = m.group(1).strip(); continue
        m = re.match(r'([A-Za-z ()]+?)\s*:\s*(\d+(?:[.,]\d+)?)\s*cm\b', l, re.I)
        if m: out.append(((sec + ' ' if sec else '') + m.group(1).strip().lower()).strip().capitalize() + ' ' + m.group(2).replace(',', '.') + ' cm')
    if not out:
        # Elevated Archives layout: label line, then "xx inch", then "yy cm"
        toks = [t.strip() for t in d.split('\n') if t.strip()]
        for i, t in enumerate(toks):
            if re.fullmatch(r'[A-Za-z ()]+', t) and i + 2 < len(toks) and re.search(r'inch', toks[i + 1], re.I) and re.search(r'cm', toks[i + 2], re.I):
                cm = re.search(r'(\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?)\s*cm', toks[i + 2])
                if cm and t.lower() != 'measurements': out.append(t.capitalize() + ' ' + cm.group(1).replace(' ', '') + ' cm')
    if gina: out.append(text(gina))
    return ', '.join(out)

def size(desc):
    d = str(desc or '')
    m = re.search(r'\bSize\s*:\s*([^\n]+)', d)
    if m:
        v = text(m.group(1))
        if re.fullmatch(r'one size', v, re.I): return 'One size|One size', ''
        n = re.fullmatch(r'(IT|FR|UK|US|JP|EU)\s*(\d{1,2}(?:\.5)?)', v, re.I)
        if n: return ('Shoes EU' if n.group(1).upper() == 'EU' else n.group(1).upper()) + '|' + n.group(2), ''
        if re.fullmatch(r'(XXS|XS|S|M|L|XL|XXL)', v, re.I): return 'Letter|' + v.upper(), ''
        if re.fullmatch(r'\d{1,2}', v): return '|' + v, ''
        return '', 'Boutique size: ' + v
    m = re.search(r'Fits size\s*([^\n]+)', d, re.I)
    if m: return '', 'Boutique says fits size ' + text(m.group(1))
    m = re.search(r"Option's Recommend(?:ed|ation) Size\s*\n((?:.*\n?){1,2})", d, re.I)
    if m: return '', "Option's recommended size: " + text(m.group(1).replace('\n', ' '))
    return '', ''

def condition(desc):
    m = re.search(r'\b(new with tags|like new|excellent|very good|good|fair|poor)\b(?:\s+\w+)?\s+condition', str(desc or ''), re.I)
    return m.group(1).capitalize() if m else ''

def materials(desc):
    m = re.search(r'\n\s*Materials\s*\n((?:\s*\d+%[^\n]+\n?)+)', str(desc or ''), re.I)
    return ', '.join(x.strip() for x in m.group(1).split('\n') if x.strip()) if m else ''

items, drafts, flags = [], [], []
for r in rows:
    tid = text(col(r, 'Temp ID'))
    title = str(col(r, 'FORM title draft') or '').split('\n')
    name = text(title[1]) if len(title) > 1 else ''
    tseason = text(title[2]) if len(title) > 2 else ''
    orig = text(col(r, 'Product / Description'))
    desc = str(col(r, 'Boutique description (source)') or '').strip()
    sz, sznote = size(desc)
    mats = materials(desc)
    fl = []
    c = category(name, orig)
    if not c: fl.append('Category')
    seas = season(tseason, orig)
    team = ''
    # Team decision (26 Nov, Cyana): OP-57 Hermès trousers date from Jean Paul Gaultier's time at Hermès.
    if tid == 'OP-57':
        seas = '2004 to 2011'; fl.append('Season')
        team = "Made during Jean Paul Gaultier's time as Hermès womenswear designer (first collection Fall/Winter 2004, last Spring/Summer 2011). Team note 26 Nov (Cyana); replaces the tracker's 1980s to 1990s."
    if not tseason and seas: fl.append('Season')
    if sz: fl.append('Size')
    cx = ctx.get(tid, {})
    notes = [
        f"Tracker: week {col(r,'Week').date() if hasattr(col(r,'Week'),'date') else text(col(r,'Week'))}, {text(col(r,'City'))}, status {text(col(r,'Status'))}, capture tier {text(col(r,'Capture Tier')) or '-'}",
        f"Tracker copy status: {text(col(r,'Copy status'))}",
        sznote,
        ('Boutique composition: ' + mats) if mats else '',
        ('Photographer: ' + text(col(r, 'Photographer'))) if col(r, 'Photographer') else '',
        ('Model: ' + text(col(r, 'Model (if applicable)'))) if col(r, 'Model (if applicable)') else '',
    ]
    items.append({
        'Boutique': text(col(r, 'Boutique')), 'Temp ID': tid, 'Boutique ID': text(col(r, 'Supplier product ID')), 'SKU': text(col(r, 'Carro SKU')),
        'Listing URL': text(col(r, 'Boutique Shop Link')), 'Original title': orig, 'Photo folder': text(col(r, 'Drive Folder')),
        'Boutique description (source)': desc, 'Condition': condition(desc), 'Brand': text(col(r, 'Designer')).upper(),
        'Item name': name, 'Category': c, 'Season': seas, 'Colour': ' '.join(name.split()[:3]),
        'Size system': sz.split('|')[0] if '|' in sz else '', 'Size': sz.split('|')[1] if '|' in sz else sz, 'Measurements': measurements(desc, col(r, 'Measurements (Gina)')),
        'Team facts': team, 'Reference links': ' '.join(u.strip() for u in str(cx.get('History source URLs') or '').split('|') if u.strip()),
        'Item notes': '\n'.join(x for x in notes if x),
    })
    flags.append(fl)
    drafts.append({'Temp ID': tid, 'Boutique': text(col(r, 'Boutique')), 'FORM title draft': col(r, 'FORM title draft'), 'FORM description draft': col(r, 'FORM description draft'), 'Copy status (tracker)': col(r, 'Copy status')})
json.dump({'items': items, 'drafts': drafts, 'flags': flags}, open(sys.argv[2], 'w'), ensure_ascii=False, default=str)
print(len(items), 'rows')
