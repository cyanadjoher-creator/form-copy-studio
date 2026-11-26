// First-run data: Soukita's copy-tool test set (copy as she entered it), one boutique listing example,
// the default vocabulary and both prompts. Runs only when the products table is empty.
import type { Query } from './db';
import { DEFAULT_PROMPT, DEFAULT_RULES, DEFAULT_VOCAB, blankProduct, normSeason, readBoutiqueText, type Product, GARMENT_CODE_MISSING, refKey } from './domain';
import { SOUKITA_PROMPT } from './soukita-prompt';
import seedItems from './seed-data.json';
import seedHashes from './seed-photos.json';

const HASH = seedHashes as Record<string, string>;
const ROLES: Record<string, string[]> = {
  P1000: ['Garment view', 'Garment view', 'Garment view', 'Construction detail', 'Construction detail', 'Garment view', 'Garment view', 'Brand label', 'Care or composition label'],
  P1001: ['Garment view', 'Garment view', 'Construction detail', 'Construction detail', 'Brand label', 'Care or composition label'],
};
const STAMP = '2026-11-20 14:00';

export async function seedIfEmpty(q: Query) {
  const [{ n }] = await q<{ n: number }>('select count(*)::int as n from products');
  if (n > 0 || process.env.SKIP_SEED === '1') return;

  await q(`insert into boutiques (id, name, imported) values ('B0','Not assigned',''), ('B1','Elevated Archives','2026-11-20 14:37') on conflict do nothing`);

  const products: Product[] = [];
  const dg = blankProduct('B1');
  const dgs = normSeason('2000s');
  Object.assign(dg, {
    id: 'P1000', sku: '2000s-dolce-gabbana-tweed-wool-jacket-default-title-default-title', productCode: '', boutiqueRef: '16493691076943',
    brand: 'DOLCE & GABBANA', name: 'Taupe Tweed Wool Jacket', category: 'Jackets', colour: 'Taupe', material: 'Tweed',
    measurements: 'Chest 49 cm, length 61 cm', seasonRaw: '2000s', season: dgs.season, seasonType: dgs.type, seasonYear: dgs.yv, year: dgs.year,
    sizeSystem: 'IT', size: '44', condition: 'Very good', price: '$253.00 suggested retail · $227.70 cost', status: 'Photographed',
    boutiqueDesc: '2000s Dolce & Gabbana tweed wool jacket. This vintage Dolce & Gabbana jacket from the 2000s showcases the Italian duo’s interpretation of classic tailoring through a softly structured, feminine silhouette. Crafted from textured wool tweed in a muted taupe shade, it features a pointed collar, a button-front closure, and two flap pockets positioned at the waist. The slightly cropped length and fitted construction lend the piece a refined, understated character, balancing traditional sartorial influences with Dolce & Gabbana’s signature elegance. Very good vintage condition. Size 44. Measurements: chest 19.5 inch / 49 cm, length 24 inch / 61 cm.',
    notes: 'Listing title: "2000s Dolce & Gabbana Tweed Wool Jacket" · Boutique: Elevated Archives · Tag: size44',
    // Soukita's review (23 Nov): keep size 44, hold fibre and lining until a clearer label photo.
    holds: [
      'Fibre: the care label looks like 100% virgin wool (Lana vergine) but the photo is blurry. Confirm with a clearer label photo before stating it',
      'Lining: the composition is not visible on any photo. Confirm with a clearer label photo before stating it',
    ],
    flags: [GARMENT_CODE_MISSING],
    updated: '2026-11-20 14:37',
    history: [{ t: '2026-11-20 14:37', s: 'Imported', n: 'from the Elevated Archives listing (example)' }],
  });
  ['brand', 'name', 'category', 'colour', 'material', 'size', 'condition', 'measurements', 'boutiqueRef', 'season'].forEach((k) => (dg.fieldSrc[k] = 'file'));
  readBoutiqueText(dg, DEFAULT_VOCAB);
  products.push(dg);

  for (const it of seedItems as Record<string, unknown>[]) {
    const p = blankProduct('B0');
    const ns = normSeason(String(it.season));
    const sources = it.sources as Product['sources'];
    Object.assign(p, {
      id: it.id, brand: it.brand, name: it.name, category: it.category, colour: it.colour, material: it.material,
      madeIn: it.madeIn, measurements: it.measurements, status: it.status, copy: it.copy, boutiqueText: it.boutiqueText, sources,
      seasonRaw: it.season, season: ns.season, seasonType: ns.type, seasonYear: ns.yv, year: ns.year, updated: STAMP,
      boutiqueId: sources.some((s) => /^Elevated Archives/.test(s.title)) ? 'B1' : 'B0',
      history: [{ t: STAMP, s: String(it.status), n: 'from the garment copy tool test (Soukita)' }],
    });
    products.push(p);
  }

  for (const p of products) {
    const roles = ROLES[p.id] || ['Garment view'];
    p.photos = [];
    await q('insert into products (id, data) values ($1, $2::jsonb) on conflict do nothing', [p.id, JSON.stringify({ ...p, photos: undefined })]);
    for (let i = 0; i < roles.length; i++) {
      const file = `${p.id.toLowerCase()}-${i + 1}.jpg`;
      if (!HASH[file]) continue;
      await q('insert into photos (id, product_id, url, role, sha256, position) values ($1,$2,$3,$4,$5,$6) on conflict do nothing',
        [`${p.id}-${i + 1}`, p.id, `/seed/${file}`, roles[i], HASH[file], i]);
    }
  }

  await q(`insert into prompts (v, body, rules, note, created, active) values
    (1, $1, $2, 'Placeholder - replaced by Soukita''s prompt', '2026-11-20 19:00', false),
    (2, $3, $2, 'FORM reviewed workflow · evidence, wear and sizing', '2026-11-21 11:00', true) on conflict do nothing`,
    [DEFAULT_PROMPT, DEFAULT_RULES, SOUKITA_PROMPT]);

  for (const [key, value] of Object.entries(DEFAULT_VOCAB))
    await q('insert into vocab (key, value) values ($1, $2::jsonb) on conflict do nothing', [key, JSON.stringify(value)]);

  const refs = [
    // These numbers are the boutique's listing IDs, not codes printed on the garments.
    { code: '', boutiqueRef: '16493691076943', brand: 'DOLCE & GABBANA', season: '2000s', name: '2000s Dolce & Gabbana Tweed Wool Jacket', category: 'Jackets', source: 'Elevated Archives listing', note: 'Garment code not recorded yet' },
    { code: '', boutiqueRef: '16493690356047', brand: 'ROBERTO CAVALLI', season: '2000s', name: '2000s Roberto Cavalli Four Pocket Safari Jacket', category: 'Jackets', source: 'Elevated Archives listing', note: 'Garment code not recorded yet' },
    { code: '', boutiqueRef: '16493696581967', brand: 'YVES SAINT LAURENT', season: '2000s', name: '2000s Yves Saint Laurent by Tom Ford Belted Short Trench', category: 'Coats', source: 'Elevated Archives listing', note: 'Listed as Saint Laurent; garment code not recorded yet' },
  ];
  for (const r of refs) await q('insert into refs (code, data) values ($1, $2::jsonb) on conflict do nothing', [refKey(r), JSON.stringify(r)]);
}
