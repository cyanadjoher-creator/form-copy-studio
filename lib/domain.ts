// Shared, pure logic used by both the browser and the server.
// No I/O here: everything is deterministic so it can be tested.

export const STAGES = ['Imported', 'Photographed', 'Drafted', 'In review', 'Approved', 'In Shopify'] as const;
export type Stage = (typeof STAGES)[number];
export const DONE: Stage[] = ['Approved', 'In Shopify'];
export const PROG: Stage[] = ['Drafted', 'In review'];

// Photo roles follow Soukita's v42 tool so prompts and data stay compatible.
export const PHOTO_ROLES = ['Garment view', 'Construction detail', 'Brand label', 'Care or composition label', 'Condition detail', 'Measurements'] as const;
export const ROLE_LABEL = 'Brand label';
export const ROLE_CARE = 'Care or composition label';
export const MAX_PHOTOS = 9;

export type Source = { title: string; url?: string; supports?: string };
export type Photo = { id: string; url: string; role: string; sha256: string; position: number };
export type HistoryItem = { t: string; s: string; n: string };

export type Product = {
  id: string; sku: string; boutiqueRef: string; productCode: string; boutiqueId: string;
  brand: string; name: string; category: string; colour: string; material: string;
  madeIn: string; measurements: string; care: string;
  seasonRaw: string; season: string; seasonType: string; seasonYear: string; year: number | null;
  sizeSystem: string; size: string; condition: string; price: string;
  boutiqueDesc: string; notes: string; research: string; sources: Source[];
  status: Stage; needsInfo: boolean; copy: string; boutiqueText: string; flags: string[];
  /** Checks held until confirmed (e.g. fibre on a blurry label). They survive regeneration and are cleared by hand. */
  holds: string[];
  promptV: number | null; updated: string; history: HistoryItem[];
  fieldSrc: Record<string, string>; conflicts: Record<string, string>;
  photos: Photo[];
};

export type Vocab = {
  brands: string[]; archiveBrands: string[]; seasonTypes: string[]; categories: string[];
  colours: string[]; materials: string[]; conditions: string[]; sizes: Record<string, string[]>;
};

export type Ref = { code: string; boutiqueRef?: string; brand: string; season: string; name: string; category: string; source: string; note: string };
export type Boutique = { id: string; name: string; imported: string };
export type Prompt = { v: number; text: string; rules: string; note: string; created: string; active: boolean };

export const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
export const uid = (p = 'P') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function blankProduct(boutiqueId = 'B0'): Product {
  return {
    id: uid('P'), sku: '', boutiqueRef: '', productCode: '', boutiqueId, brand: '', name: '', category: '', colour: '', material: '',
    madeIn: '', measurements: '', care: '', seasonRaw: '', season: 'Unknown', seasonType: 'Unknown', seasonYear: '', year: null,
    sizeSystem: '', size: '', condition: '', price: '', boutiqueDesc: '', notes: '', research: '', sources: [],
    status: 'Imported', needsInfo: false, copy: '', boutiqueText: '', flags: [], holds: [], promptV: null, updated: now(),
    history: [], fieldSrc: {}, conflicts: {}, photos: [],
  };
}

/* ---------- seasons ---------- */
export function seasonCompose(t: string, yv: string) {
  if (!t || t === 'Unknown' || t === 'Decade') return yv || 'Unknown';
  return yv ? `${t} ${yv}` : t;
}
export function normSeason(raw: string | undefined | null) {
  const s = String(raw || '').trim();
  if (!s) return { season: 'Unknown', type: 'Unknown', year: null as number | null, yv: '' };
  let type = 'Unknown';
  if (/pre[\s-]?fall/i.test(s)) type = 'Pre-Fall';
  else if (/cruise|resort|pre[\s-]?spring/i.test(s)) type = 'Cruise / Resort';
  else if (/couture|artisanal/i.test(s)) type = 'Couture';
  else if (/capsule/i.test(s)) type = 'Capsule';
  else if (/commercial/i.test(s)) type = 'Commercial Look';
  else if (/(^|[^a-z])(fw|aw|f\/w|a\/w|fall|autumn|winter|ah)/i.test(s)) type = 'Fall/Winter';
  else if (/(^|[^a-z])(ss|s\/s|spring|summer|pe|p\/e)/i.test(s)) type = 'Spring/Summer';
  const dec = s.match(/\b((?:19|20)?\d0)s\b/i);
  if (type === 'Unknown' && dec) {
    let d = dec[1];
    if (d.length === 2) d = (+d > 40 ? '19' : '20') + d;
    return { season: d + 's', type: 'Decade', year: +d as number | null, yv: d + 's' };
  }
  let year: number | null = null;
  const four = s.match(/(19|20)\d{2}/);
  if (four) year = +four[0];
  else {
    const two = s.match(/(\d{2})(?!\d)/);
    if (two) { const y = +two[1]; year = y > 40 ? 1900 + y : 2000 + y; }
  }
  const yv = year ? String(year) : '';
  return { season: seasonCompose(type, yv), type, year, yv };
}
export const decade = (y: number | null) => (y ? Math.floor(y / 10) * 10 + 's' : 'Undated');

export function titleCase(s: string) {
  return String(s || '').toLowerCase().replace(/(^|[\s&-])(\S)/g, (_m, a, b) => a + b.toUpperCase())
    .replace('Mcqueen', 'McQueen').replace('Des Garçons', 'des Garçons');
}
export const group = (p: Product) => (DONE.includes(p.status) ? 'done' : PROG.includes(p.status) ? 'prog' : 'ns');
export const normCode = (c: string) => String(c || '').toUpperCase().replace(/[\s._/-]/g, '');
export const hasRole = (p: Product, role: string) => (p.photos || []).some((x) => x.role === role);

/* ---------- vocabulary ---------- */
export const DEFAULT_VOCAB: Vocab = {
  brands: ['ALEXANDER MCQUEEN', 'ANN DEMEULEMEESTER', 'BALENCIAGA', 'CÉLINE', 'CHRISTIAN DIOR', 'COMME DES GARÇONS', 'DIRK BIKKEMBERGS', 'DOLCE & GABBANA', 'GUCCI', 'JEAN PAUL GAULTIER', 'JOHN GALLIANO', 'JUN TAKAHASHI', 'MAISON MARTIN MARGIELA', 'RAF SIMONS', 'RICK OWENS', 'ROBERTO CAVALLI', 'YVES SAINT LAURENT'],
  archiveBrands: ['ALEXANDER MCQUEEN', 'COMME DES GARÇONS', 'JOHN GALLIANO', 'JUN TAKAHASHI', 'MAISON MARTIN MARGIELA', 'RAF SIMONS', 'RICK OWENS'],
  seasonTypes: ['Spring/Summer', 'Fall/Winter', 'Pre-Fall', 'Cruise / Resort', 'Couture', 'Capsule', 'Commercial Look', 'Decade', 'Unknown'],
  categories: ['Bags', 'Belts', 'Blazers', 'Blouses', 'Boots', 'Cardigans', 'Coats', 'Dresses', 'Gloves', 'Hats', 'Hoodies & Sweatshirts', 'Jackets', 'Jeans', 'Jewellery', 'Jumpers', 'Knitwear', 'Lingerie', 'Scarves', 'Sets', 'Shirts', 'Shoes', 'Shorts', 'Skirts', 'Small leather goods', 'Suits', 'Swimwear', 'T-shirts', 'Tank tops', 'Tops', 'Trousers', 'Waistcoats'],
  colours: ['Beige', 'Black', 'Blue', 'Brown', 'Burgundy', 'Camel', 'Charcoal', 'Cream', 'Gold', 'Green', 'Grey', 'Ivory', 'Khaki', 'Multicolour', 'Navy', 'Olive', 'Orange', 'Pink', 'Purple', 'Red', 'Silver', 'Taupe', 'White', 'Yellow'],
  materials: ['Calfskin', 'Cashmere', 'Cotton', 'Cotton jersey', 'Denim', 'Fur', 'Lambskin', 'Leather', 'Linen', 'Mesh', 'Modal jersey', 'Mohair', 'Nylon', 'Polyester', 'Satin', 'Shearling', 'Silk', 'Suede', 'Tweed', 'Viscose', 'Wool', 'Wool and silk', 'Wool-blend'],
  conditions: ['New with tags', 'Unworn', 'Excellent', 'Very good', 'Good', 'Fair', 'As is'],
  sizes: { IT: ['36', '38', '40', '42', '44', '46', '48', '50', '52', '54'], FR: ['32', '34', '36', '38', '40', '42', '44', '46', '48'], UK: ['4', '6', '8', '10', '12', '14', '16', '18'], US: ['0', '2', '4', '6', '8', '10', '12', '14'], JP: ['0', '1', '2', '3', '4', '5'], Letter: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'], 'Shoes EU': ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'], 'One size': ['One size'] },
};
export const VOCAB_LISTS: { key: keyof Vocab; label: string; field: keyof Product | null; help: string; ordered?: boolean }[] = [
  { key: 'brands', label: 'Brands', field: 'brand', help: 'To connect: the FORM ontology Brand Master, then the Shopify vendor list.' },
  { key: 'archiveBrands', label: 'Brands in the archive', field: 'brand', help: 'Houses already recorded in the FORM archive. The Overview uses this list to show what the stock matches and which brands are missing.' },
  { key: 'categories', label: 'Categories', field: 'category', help: '' },
  { key: 'colours', label: 'Colours', field: 'colour', help: '' },
  { key: 'materials', label: 'Materials', field: 'material', help: '' },
  { key: 'conditions', label: 'Conditions', field: 'condition', help: 'Kept in grading order, best to worst.', ordered: true },
  { key: 'seasonTypes', label: 'Season types', field: 'seasonType', help: 'The ontology season vocabulary, kept in this order. Decade is for pieces dated only by era.', ordered: true },
  { key: 'sizes', label: 'Sizes', field: null, help: 'One list per size system, in size order.' },
];

/* ---------- import mapping ---------- */
export const FIELDS: [keyof Product, string, string[]][] = [
  ['sku', 'Boutique SKU', ['variant sku', 'sku', 'stock', 'stock number', 'boutique ref', 'ref']],
  // The boutique's own listing or Shopify ID. Kept apart from the code printed on the garment.
  ['boutiqueRef', 'Boutique ID (listing or Shopify ID)', ['id', 'product id', 'shopify id', 'listing id', 'boutique id', 'item id', 'variant id']],
  ['productCode', 'Product code (on the garment label)', ['product code', 'style code', 'style', 'model code', 'model', 'modèle', 'code produit', 'article', 'reference', 'référence', 'code']],
  ['brand', 'Brand', ['vendor', 'brand', 'designer', 'maison', 'house', 'label', 'marque']],
  ['name', 'Item name', ['title', 'name', 'item', 'product', 'product name', 'item name', 'nom']],
  ['category', 'Category', ['product type', 'product category', 'category', 'type', 'categorie', 'catégorie', 'department']],
  ['seasonRaw', 'Season / era', ['season', 'collection', 'saison', 'year', 'era', 'date']],
  ['size', 'Size', ['size', 'taille']],
  ['condition', 'Condition', ['condition', 'état', 'etat', 'grade']],
  ['material', 'Material', ['material', 'composition', 'fabric', 'matière', 'matiere']],
  ['colour', 'Colour', ['colour', 'color', 'couleur', 'colorway', 'colourway']],
  ['madeIn', 'Made in', ['made in', 'origin', 'country', 'country of origin', 'provenance', 'fabrication']],
  ['measurements', 'Measurements', ['measurements', 'dimensions', 'mesures', 'measures']],
  ['price', 'Price', ['variant price', 'price', 'prix', 'retail', 'resale price']],
  ['care', 'Care instructions', ['care', 'care instructions', 'washing', 'wash', 'entretien']],
  ['boutiqueDesc', 'Boutique description', ['body (html)', 'body', 'description', 'notes', 'details', 'remarks', 'commentaire', 'comments']],
];
export function guessField(header: string): string {
  const h = header.toLowerCase().trim();
  for (const [k, , syn] of FIELDS) if (syn.some((s) => h === s)) return k as string;
  for (const [k, , syn] of FIELDS) if (syn.some((s) => s.length > 2 && h.includes(s))) return k as string;
  return '';
}
export function parseCSV(text: string): string[][] {
  const line = text.split('\n')[0] || '';
  const count = (c: string) => (line.match(new RegExp('\\' + c, 'g')) || []).length;
  const delim = count('\t') > count(';') ? '\t' : count(';') > count(',') ? ';' : ',';
  const rows: string[][] = []; let row: string[] = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim()));
}
/** A Shopify product export has one row per variant or image, grouped by Handle: merge them into one item. */
export function shopifyGroup(rows: string[][]): { rows: string[][]; merged: boolean } {
  const head = rows[0].map((x) => String(x).trim());
  const hi = head.findIndex((x) => x.toLowerCase() === 'handle');
  if (hi < 0) return { rows, merged: false };
  const ii = head.findIndex((x) => x.toLowerCase() === 'image src');
  const bi = head.findIndex((x) => /^body/i.test(x));
  const g = new Map<string, { row: string[]; imgs: string[] }>();
  rows.slice(1).forEach((r) => {
    const k = r[hi]; if (!k) return;
    const cur = g.get(k);
    if (!cur) { g.set(k, { row: [...r], imgs: ii >= 0 && r[ii] ? [r[ii]] : [] }); return; }
    r.forEach((v, i) => { if (String(v).trim() && !String(cur.row[i] || '').trim()) cur.row[i] = v; });
    if (ii >= 0 && r[ii]) cur.imgs.push(r[ii]);
  });
  const out = [head];
  g.forEach(({ row, imgs }) => {
    if (bi >= 0) row[bi] = stripHtml(row[bi]);
    if (ii >= 0) row[ii] = imgs.join(' | ');
    out.push(row);
  });
  return { rows: out, merged: true };
}
export const stripHtml = (s: string) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

/* ---------- reading the boutique text (rules, no AI) ---------- */
export const FIELD_LABEL: Record<string, string> = { boutiqueRef: 'Boutique ID', brand: 'Brand', name: 'Item name', season: 'Season', category: 'Category', colour: 'Colour', material: 'Material', size: 'Size', condition: 'Condition', productCode: 'Product code (garment label)', madeIn: 'Made in', measurements: 'Measurements', care: 'Care' };
export const REQUIRED = ['brand', 'name', 'season', 'category', 'colour', 'material', 'size', 'condition', 'productCode'];
const CAT_WORDS: [string, string][] = [['t-shirt', 'T-shirts'], ['tee', 'T-shirts'], ['tank top', 'Tank tops'], ['tank', 'Tank tops'], ['hoodie', 'Hoodies & Sweatshirts'], ['sweatshirt', 'Hoodies & Sweatshirts'], ['cardigan', 'Cardigans'], ['jumper', 'Jumpers'], ['sweater', 'Jumpers'], ['blazer', 'Blazers'], ['jacket', 'Jackets'], ['trench', 'Coats'], ['coat', 'Coats'], ['waistcoat', 'Waistcoats'], ['trousers', 'Trousers'], ['pants', 'Trousers'], ['jeans', 'Jeans'], ['skirt', 'Skirts'], ['dress', 'Dresses'], ['blouse', 'Blouses'], ['shirt', 'Shirts'], ['boots', 'Boots'], ['shoes', 'Shoes'], ['heels', 'Shoes'], ['loafers', 'Shoes'], ['sneakers', 'Shoes'], ['tote', 'Bags'], ['bag', 'Bags'], ['clutch', 'Bags'], ['belt', 'Belts'], ['scarf', 'Scarves'], ['hat', 'Hats'], ['gloves', 'Gloves'], ['knit', 'Knitwear'], ['top', 'Tops']];
const COLOUR_SYN: Record<string, string> = { gray: 'Grey', multicolor: 'Multicolour', multicoloured: 'Multicolour', multicolored: 'Multicolour' };
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (w: string) => new RegExp('(^|[^a-zà-ÿ])' + reEsc(w.toLowerCase()) + 's?(?![a-zà-ÿ])', 'i');
export const normV = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const isEmptyField = (p: Product, k: string) =>
  k === 'season' ? !p.seasonYear && (!p.seasonType || p.seasonType === 'Unknown')
    : !String((p as unknown as Record<string, unknown>)[k] || '').trim() || (k === 'brand' && p.brand === 'UNKNOWN');
export function canon(list: string[], v: string) { if (!v) return v; const n = normV(v); return (list || []).find((x) => normV(x) === n) || v; }
function findTerms(text: string, terms: string[]) {
  let rest = ' ' + String(text || '').toLowerCase() + ' ';
  const hits: string[] = [];
  [...terms].sort((a, b) => b.length - a.length).forEach((term) => {
    if (wordRe(term).test(rest)) { hits.push(term); rest = rest.replace(new RegExp(reEsc(term.toLowerCase()), 'gi'), ' '); }
  });
  return hits;
}
export function parseBoutiqueText(p: Product, vocab: Vocab) {
  const desc = String(p.boutiqueDesc || '');
  const first = desc.split(/(?<=[.!?])\s/)[0] || '';
  const vals: Record<string, string> = {};
  let season: ReturnType<typeof normSeason> | null = null;
  const ambig: string[] = [];
  const one = (k: string, label: string, fromName: string[], fromDesc: string[]) => {
    const u = [...new Set(fromName.length ? fromName : fromDesc)];
    if (u.length === 1) vals[k] = u[0];
    else if (u.length > 1) ambig.push(`Boutique text mentions several ${label}: ${u.join(', ')} - choose one`);
  };
  one('brand', 'brands', findTerms(p.name, vocab.brands).map((x) => x.toUpperCase()), findTerms(desc, vocab.brands).map((x) => x.toUpperCase()));
  const cat = (txt: string) => { const t = String(txt || '').toLowerCase(); for (const [w, c] of CAT_WORDS) if (wordRe(w).test(t)) return [c]; return []; };
  one('category', 'categories', cat(p.name), cat(first));
  const colourTerms = [...vocab.colours, ...Object.keys(COLOUR_SYN)];
  const col = (txt: string) => findTerms(txt, colourTerms).map((x) => COLOUR_SYN[x.toLowerCase()] || canon(vocab.colours, x));
  one('colour', 'colours', col(p.name), col(first));
  const mat = (txt: string) => findTerms(txt, vocab.materials).map((x) => canon(vocab.materials, x));
  one('material', 'materials', mat(p.name), mat(desc));
  one('condition', 'conditions', [], findTerms(desc, vocab.conditions).map((x) => canon(vocab.conditions, x)));
  const sz = desc.match(/\b(?:size|taille|sz)\s*:?\s*(IT|FR|UK|US|JP)?\s*(\d{1,2}(?:\.5)?|XXS|XS|S|M|L|XL|XXL)\b/i);
  let sizeSystem = '';
  if (sz) { vals.size = sz[2].toUpperCase(); if (sz[1]) sizeSystem = sz[1].toUpperCase(); }
  const mi = desc.match(/made in ([A-Za-zÀ-ÿ]+(?: [A-Z][a-zà-ÿ]+)?)/i);
  if (mi) vals.madeIn = mi[1].replace(/^\w/, (c) => c.toUpperCase());
  const ms: string[] = []; const seen = new Set<string>();
  const re = /(chest|bust|length|waist|sleeve|shoulders?|inseam|rise|hips?|height|width|depth)[^0-9\n]{0,20}(\d+(?:[.,]\d+)?)\s*(cm|in(?:ch(?:es)?)?\b|")/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(desc))) { const k = m[1].toLowerCase(); if (seen.has(k)) continue; seen.add(k); ms.push(`${k} ${m[2].replace(',', '.')} ${m[3].toLowerCase().startsWith('c') ? 'cm' : 'in'}`); }
  if (ms.length) vals.measurements = ms.join(', ').replace(/^\w/, (c) => c.toUpperCase());
  const se = desc.match(/\b((?:spring|summer|fall|autumn|winter|pre-fall|resort|cruise)[\s/a-z-]*?(?:19|20)\d{2}|(?:fw|aw|ss|f\/w|a\/w|s\/s)\s?'?\d{2,4}|(?:early |late )?(?:19|20)\d0s)\b/i);
  if (se) { const ns = normSeason(se[1]); if (ns.yv) season = ns; }
  return { vals, season, sizeSystem, ambig };
}
/** Fills empty fields from the boutique text. Never overwrites; disagreements become conflicts. Returns the filled field keys. */
export function readBoutiqueText(p: Product, vocab: Vocab): string[] {
  p.fieldSrc = p.fieldSrc || {}; p.conflicts = p.conflicts || {}; p.flags = p.flags || [];
  const { vals, season, sizeSystem, ambig } = parseBoutiqueText(p, vocab);
  const filled: string[] = [];
  const rec = p as unknown as Record<string, unknown>;
  if (season) {
    if (isEmptyField(p, 'season')) { Object.assign(p, { seasonType: season.type, seasonYear: season.yv, season: season.season, year: season.year }); p.fieldSrc.season = 'desc'; filled.push('season'); }
    else if (season.season !== p.season && p.fieldSrc.season !== 'checked') p.conflicts.season = `boutique text says ${season.season}`;
  }
  Object.entries(vals).forEach(([k, v]) => {
    if (isEmptyField(p, k)) {
      rec[k] = v; p.fieldSrc[k] = 'desc'; filled.push(k);
      if (k === 'size' && !p.sizeSystem) {
        if (sizeSystem) p.sizeSystem = sizeSystem;
        else { const sys = Object.entries(vocab.sizes).filter(([, l]) => l.includes(v)); if (sys.length === 1) p.sizeSystem = sys[0][0]; }
      }
    } else if (k !== 'measurements' && normV(rec[k]) !== normV(v) && p.fieldSrc[k] !== 'checked') p.conflicts[k] = `boutique text says ${v}`;
  });
  ambig.forEach((a) => { if (!p.flags.includes(a)) p.flags.push(a); });
  return filled;
}
/** Fields returned by the model from the photos. Same rules: fill empty, flag disagreements. */
export function applyModelFields(p: Product, f: Record<string, unknown> | undefined): string[] {
  const filled: string[] = []; if (!f) return filled;
  p.fieldSrc = p.fieldSrc || {}; p.conflicts = p.conflicts || {};
  const rec = p as unknown as Record<string, unknown>;
  const set = (k: string, raw: unknown, what = 'photos show') => {
    if (!raw) return; const v = String(raw).trim(); if (!v) return;
    if (isEmptyField(p, k)) { rec[k] = v; p.fieldSrc[k] = 'photos'; filled.push(k); }
    else if (!['measurements', 'name'].includes(k) && normV(rec[k]) !== normV(v) && p.fieldSrc[k] !== 'checked') p.conflicts[k] = `${what} ${v}`;
  };
  if (f.brand) set('brand', String(f.brand).toUpperCase());
  set('name', f.name); set('category', f.category); set('colour', f.colour); set('material', f.material);
  set('condition', f.condition); set('madeIn', f.made_in, 'label says'); set('measurements', f.measurements);
  set('productCode', f.product_code, 'label reads');
  if (f.size) {
    if (!p.size) { p.size = String(f.size); if (f.size_system && !p.sizeSystem) p.sizeSystem = String(f.size_system); p.fieldSrc.size = 'photos'; filled.push('size'); }
    else if (normV(p.size) !== normV(f.size) && p.fieldSrc.size !== 'checked') p.conflicts.size = `label shows ${f.size}`;
  }
  if ((f.season_type || f.season_year) && isEmptyField(p, 'season')) {
    p.seasonType = String(f.season_type || 'Unknown'); p.seasonYear = String(f.season_year || '');
    p.season = seasonCompose(p.seasonType, p.seasonYear); p.year = parseInt(p.seasonYear) || null; p.fieldSrc.season = 'photos'; filled.push('season');
  }
  if (f.care_instructions && !p.care) { p.care = String(f.care_instructions); p.fieldSrc.care = 'photos'; filled.push('care'); }
  return filled;
}
export function readiness(p: Product) {
  const fs = p.fieldSrc || {}, cf = p.conflicts || {};
  return {
    missing: REQUIRED.filter((k) => isEmptyField(p, k)).map((k) => FIELD_LABEL[k]),
    conflicts: Object.keys(cf).map((k) => FIELD_LABEL[k] || k),
    tocheck: Object.entries(fs).filter(([k, v]) => (v === 'desc' || v === 'photos') && !isEmptyField(p, k) && !cf[k]).map(([k]) => FIELD_LABEL[k] || k),
  };
}

/* ---------- house style check ---------- */
const SEASON_LINE = /^((Spring\/Summer|Fall\/Winter|Pre-Fall|Cruise \/ Resort|Couture|Capsule) \d{4}|\d{4}s)$/;
export function lint(p: Product) {
  const t = (p.copy || '') + '\n' + (p.boutiqueText || '');
  const out: { ok: boolean; label: string }[] = [];
  const add = (ok: boolean, label: string) => out.push({ ok, label });
  add(!!p.productCode, 'Product code recorded');
  add(!/[—–]/.test(t), 'No em or en dashes');
  const us = t.match(/\b(color|colors|center|gray|jewelry|favorite|fiber|catalog|theater|centered|colored)\b/gi);
  add(!us, 'British spelling' + (us ? ': ' + [...new Set(us.map((x) => x.toLowerCase()))].join(', ') : ''));
  add(!/Maison Margiela/.test(t.replace(/Maison Martin Margiela/g, '')), 'Maison Martin Margiela naming');
  if (p.copy) {
    const lines = p.copy.trim().split('\n');
    add(lines[0] === lines[0].toUpperCase(), 'Brand on first line in capitals');
    const sl = (lines[2] || '').trim();
    add(SEASON_LINE.test(sl), 'Season line in house vocabulary' + (SEASON_LINE.test(sl) ? '' : `: "${sl}"`));
    add(!p.madeIn || /Made in /.test(p.copy), 'Made in line present');
    add(!(/Made in/.test(p.copy) && !p.madeIn), 'Made in only when confirmed');
    if (p.measurements) { const bl = lines.filter((l) => l.startsWith('·')); add(!!bl.length && /\d/.test(bl[bl.length - 1]), 'Measurements in final bullet'); }
    add(!/\[.*?\]/.test(p.copy), 'No placeholders left');
    add(!/\b(iconic|stunning|timeless|must-have)\b/i.test(t), 'No promotional adjectives');
  }
  return out;
}

/* ---------- prompt assembly ---------- */
export const DEFAULT_PROMPT = `You write garment copy for FORM, a fashion archive.
Read the photos and the confirmed details. Describe only what is confirmed or clearly visible.

WEBSITE COPY - plain text, in this exact order:
{{BRAND}}
{{name}}
{{season}}

One short paragraph of context: the designer, the collection, and where this piece sits in it (look number if known). Only what the details or research leads confirm.

One sentence: material and garment type, with the main construction feature.

Bullets starting with "· ", one feature each. If measurements are given, they are the final bullet.

Made in [country]. Only when the country is confirmed.

BOUTIQUE TEXT - 2 to 4 sentences: design first, then history, then wear and included items.`;
export const DEFAULT_RULES = `British spelling throughout.
No em dashes or en dashes: plain hyphens only.
Maison Martin Margiela is the brand name (never "Maison Margiela"); Martin Margiela is the designer.
Dior is the house, Christian Dior the designer. Alexander McQueen is canonical.
Seasons use: Spring/Summer, Fall/Winter, Pre-Fall, Cruise / Resort, Couture, Capsule.
Never invent a fact. If something is uncertain, leave it out and add it to flags.
No promotional adjectives (iconic, stunning, timeless, must-have).`;

export function fillPrompt(text: string, p: Product) {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k === 'BRAND' ? p.brand : String((p as unknown as Record<string, unknown>)[k] ?? m)));
}
export function detailsBlock(p: Product) {
  return [
    `Brand: ${p.brand}`, `Item name: ${p.name}`, `Category: ${p.category}`,
    `Season: ${p.season}${p.seasonRaw && p.seasonRaw !== p.season ? ` (boutique wrote "${p.seasonRaw}")` : ''}`,
    `Colour: ${p.colour}`, `Material: ${p.material}`, `Size: ${[p.sizeSystem, p.size].filter(Boolean).join(' ')}`, `Condition: ${p.condition}`,
    `Made in (confirmed): ${p.madeIn || 'NOT CONFIRMED - do not write a Made in line unless a label photo shows it'}`,
    `Measurements: ${p.measurements || 'none'}`, `Product code on file: ${p.productCode || 'none'}`, ...((p.holds || []).length ? [`Not confirmed yet, do not state these and repeat them in flags: ${p.holds.join(' | ')}`] : []), `Care on file: ${p.care || 'none'}`,
    `Boutique description: ${p.boutiqueDesc || 'none'}`, `Item notes: ${p.notes || 'none'}`, `Research leads: ${p.research || 'none'}`,
  ].join('\n');
}
/** The fixed part, kept in code so editing the house prompt can never break photo reading or the output format. */
export function buildInput(p: Product, prompt: { text: string; rules: string }, vocab: Vocab, opts: { fieldsOnly?: boolean } = {}) {
  const roles = (p.photos || []).map((x, i) => `${i + 1}. ${x.role}`).join(', ');
  return `${opts.fieldsOnly ? '' : fillPrompt(prompt.text, p) + '\n\nHOUSE RULES\n' + prompt.rules + '\n\n'}ONTOLOGY CONTEXT
(Not connected yet. The matching Brand, Designer, Collection Master and Look Master records will go here.)

CONFIRMED DETAILS
${detailsBlock(p)}

PHOTOS
${roles ? `Attached in this order: ${roles}.
Read the product code (style or model number) from the Brand label photo and the composition and care from the Care or composition label photo, exactly as printed. Read dimensions only from a Measurements photo with a legible scale. If a label is unreadable, say so in flags rather than guessing.` : 'No photos attached: work from the details only and flag what you could not verify.'}

FIELDS
Fill "fields" from the photos and details. Choose values only from these lists, otherwise leave the field empty:
Brands: ${vocab.brands.join(', ')}
Categories: ${vocab.categories.join(', ')}
Colours: ${vocab.colours.join(', ')}
Materials: ${vocab.materials.join(', ')}
Conditions: ${vocab.conditions.join(', ')}
Season types: ${vocab.seasonTypes.join(', ')}
Size systems: ${Object.keys(vocab.sizes).join(', ')}
"made_in" only if printed on a label.
${opts.fieldsOnly ? 'Do not write any copy: return empty strings for website_copy and boutique_text.' : ''}

Return ONLY a JSON object, no prose around it:
{"fields":{"brand":"","name":"","category":"","colour":"","material":"","condition":"","size_system":"","size":"","season_type":"","season_year":"","made_in":"","measurements":"","product_code":"","care_instructions":""},"website_copy":"","boutique_text":"","flags":["anything uncertain, missing, unreadable or contradictory"]}`;
}
export function parseModelJson(text: string): Record<string, unknown> {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('The model did not return JSON');
  return JSON.parse(m[0]);
}

/* ---------- product codes ---------- */
export function refMatch(refs: Ref[], code: string): Ref | null {
  const n = normCode(code); if (!n) return null;
  return refs.find((r) => normCode(r.code) === n) || null;
}
export const refKey = (r: Ref) => (r.code ? String(r.code).trim() : 'B' + String(r.boutiqueRef || '').trim());
export function refLinked(products: Product[], r: Ref): Product[] {
  return products.filter((p) => (r.code && p.productCode && normCode(p.productCode) === normCode(r.code)) || (r.boutiqueRef && p.boutiqueRef && normCode(p.boutiqueRef) === normCode(r.boutiqueRef)));
}
export const GARMENT_CODE_MISSING = 'Garment code missing: read it from the brand label photo (the boutique ID is kept separately)';
export function refNear(refs: Ref[], code: string): Ref[] {
  const n = normCode(code); if (n.length < 4) return [];
  return refs.filter((r) => { const c = normCode(r.code); return !!c && c !== n && (c.includes(n) || n.includes(c)); }).slice(0, 5);
}
