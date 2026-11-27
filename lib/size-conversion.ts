// Size conversion between label systems, and what a label meant in its era.
// Conversions are indicative: every house cuts to its own block, so the garment measurements stay the reference.
// Sources (27 Nov 2026): Hugo Boss womenswear chart (EU/FR/IT/UK/US); JIS odd sizes for Japan; La Garçonne notes on
// Japanese designer sizing; sizeguide.net and Percival for menswear; Wikipedia, Vanity sizing (CS 215-58,
// ASTM D5585-95(R2001), ASTM D5585-11e1 body measurements); EN 13402 (European body-measurement labelling).

export type SizeLine = 'Womenswear' | 'Menswear';
export const SIZE_LINES: SizeLine[] = ['Womenswear', 'Menswear'];
export const REGIONS = ['EU', 'FR', 'IT', 'UK', 'US', 'JP', 'Letter'] as const;
export type Region = (typeof REGIONS)[number];
export const REGION_LABEL: Record<Region, string> = { EU: 'Europe (DE/NL/Nordic)', FR: 'France', IT: 'Italy', UK: 'United Kingdom', US: 'United States', JP: 'Japan', Letter: 'Letter (XS-XL)' };

type Row = Partial<Record<Region | 'JP designer', string>>;
/** Women's clothing: one row per size step. */
export const WOMEN: Row[] = [
  { Letter: 'XXS', EU: '32', FR: '34', IT: '36', UK: '4', US: '0', JP: '3', 'JP designer': '0' },
  { Letter: 'XS', EU: '34', FR: '36', IT: '38', UK: '6', US: '2', JP: '5', 'JP designer': '1' },
  { Letter: 'S', EU: '36', FR: '38', IT: '40', UK: '8', US: '4', JP: '7', 'JP designer': '2' },
  { Letter: 'M', EU: '38', FR: '40', IT: '42', UK: '10', US: '6', JP: '9', 'JP designer': '3' },
  { Letter: 'L', EU: '40', FR: '42', IT: '44', UK: '12', US: '8', JP: '11', 'JP designer': '4' },
  { Letter: 'XL', EU: '42', FR: '44', IT: '46', UK: '14', US: '10', JP: '13', 'JP designer': '5' },
  { Letter: 'XXL', EU: '44', FR: '46', IT: '48', UK: '16', US: '12', JP: '15' },
  { Letter: 'XXXL', EU: '46', FR: '48', IT: '50', UK: '18', US: '14', JP: '17' },
];
/** Men's tailoring, coats and knitwear: EU/IT/FR share the numbers; UK and US give the chest in inches. */
export const MEN: Row[] = [
  { Letter: 'XXS', EU: '42', FR: '42', IT: '42', UK: '32', US: '32', JP: '34', 'JP designer': '0' },
  { Letter: 'XS', EU: '44', FR: '44', IT: '44', UK: '34', US: '34', JP: '36', 'JP designer': '1' },
  { Letter: 'S', EU: '46', FR: '46', IT: '46', UK: '36', US: '36', JP: '38', 'JP designer': '2' },
  { Letter: 'M', EU: '48', FR: '48', IT: '48', UK: '38', US: '38', JP: '40', 'JP designer': '3' },
  { Letter: 'L', EU: '50', FR: '50', IT: '50', UK: '40', US: '40', JP: '42', 'JP designer': '4' },
  { Letter: 'XL', EU: '52', FR: '52', IT: '52', UK: '42', US: '42', JP: '44', 'JP designer': '5' },
  { Letter: 'XXL', EU: '54', FR: '54', IT: '54', UK: '44', US: '44', JP: '46' },
  { Letter: 'XXXL', EU: '56', FR: '56', IT: '56', UK: '46', US: '46', JP: '48' },
];
/** Men's trousers: the European number is roughly the US/UK waist in inches plus 16. */
export const MEN_TROUSERS: Row[] = [44, 46, 48, 50, 52, 54, 56].map((n, i) => ({ EU: String(n), IT: String(n), FR: String(n), UK: String(28 + i * 2), US: String(28 + i * 2), Letter: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'][i] }));
/** Shoes: EU and IT share numbers. Italian lasts often run about half a size small. */
export const SHOES_W: Row[] = [35, 36, 37, 38, 39, 40, 41, 42].map((n, i) => ({ EU: String(n), IT: String(n), FR: String(n), UK: String(2 + i), US: String(5 + i), JP: String(22 + i * 0.5).replace('.0', '') }));
export const SHOES_M: Row[] = [39, 40, 41, 42, 43, 44, 45, 46].map((n, i) => ({ EU: String(n), IT: String(n), FR: String(n), UK: String(5 + i), US: String(6 + i), JP: String(24.5 + i * 0.5).replace('.0', '') }));

const SYSTEM_TO_REGION: Record<string, Region | 'JP designer'> = { IT: 'IT', FR: 'FR', UK: 'UK', US: 'US', JP: 'JP designer', Letter: 'Letter', 'Shoes EU': 'EU', EU: 'EU' };
const isBottoms = (category: string) => /trousers|jeans|shorts|bottoms|pants/i.test(category || '');
const isShoes = (category: string, system: string) => system === 'Shoes EU' || /shoes|boots|footwear/i.test(category || '');

export type Conversion = { table: string; row: Row; from: string; assumed: string[] } | null;
/** The equivalents of a labelled size. Womenswear is assumed when the line is not set (and said so). */
export function convertSize(system: string, size: string, category = '', line = ''): Conversion {
  const s = String(size || '').trim().toUpperCase().replace(/\s+/g, '');
  const col = SYSTEM_TO_REGION[system];
  if (!s || !col || system === 'One size') return null;
  const assumed: string[] = [];
  const men = line === 'Menswear';
  if (!line) assumed.push('womenswear assumed (set the line)');
  const shoes = isShoes(category, system);
  const table = shoes ? (men ? SHOES_M : SHOES_W) : men && isBottoms(category) ? MEN_TROUSERS : men ? MEN : WOMEN;
  const name = shoes ? (men ? "Men's shoes" : "Women's shoes") : men && isBottoms(category) ? "Men's trousers" : men ? "Men's tailoring" : "Women's clothing";
  const row = table.find((r) => String(r[col] || '').toUpperCase() === s);
  return row ? { table: name, row, from: system + ' ' + size, assumed } : null;
}
export function sizeIn(c: Conversion, region: Region) {
  if (!c) return '';
  const v = c.row[region];
  return v ? (region === 'Letter' ? v : region + ' ' + v) : '';
}

/* ---------- what a label meant in its era ---------- */
// US misses body measurements, inches (bust / waist / hip). Waist and hip: ASTM 2011 "curvy" figure.
export const US_ERAS: { label: string; from: number; to: number; source: string; sizes: Record<string, [number, number, number]> }[] = [
  { label: 'Before 1995 (closest official tables: 1958)', from: 0, to: 1994, source: 'the 1958 US standard CS 215-58',
    sizes: { '8': [31, 23.5, 32.5], '10': [32.5, 24.5, 34], '12': [34, 25.5, 36], '14': [35.5, 27, 38], '16': [37, 28.5, 40] } },
  { label: '1995 to 2010 (ASTM D5585-95)', from: 1995, to: 2010, source: 'ASTM D5585-95 (R2001)',
    sizes: { '2': [32, 24, 34.5], '4': [33, 25, 35.5], '6': [34, 26, 36.5], '8': [35, 27, 37.5], '10': [36, 28, 38.5], '12': [37.5, 29.5, 40], '14': [39, 31, 41.5], '16': [40.5, 32.5, 43] } },
  { label: '2011 onwards (ASTM D5585-11)', from: 2011, to: 9999, source: 'ASTM D5585-11e1',
    sizes: { '0': [31.75, 24.625, 34.625], '2': [33, 25.375, 35.875], '4': [34.125, 26.125, 37.125], '6': [35.25, 27, 38.25], '8': [36.25, 28, 39.25], '10': [37.25, 29, 40.25], '12': [38.75, 30.75, 41.75], '14': [40.375, 32.5, 43.25], '16': [42.125, 34.5, 45] } },
];
const today = US_ERAS[US_ERAS.length - 1];
/** A US women's label read in its era: the body it was cut for, and the closest size on today's chart. */
export function usEraEquivalent(size: string, year: number | null) {
  if (!year) return null;
  const era = US_ERAS.find((e) => year >= e.from && year <= e.to)!;
  const body = era.sizes[String(size).trim()];
  if (!body || era === today) return body ? { era, body, todaySize: String(size).trim() } : null;
  const todaySize = Object.entries(today.sizes).reduce((best, [k, v]) => (Math.abs(v[0] - body[0]) < Math.abs(today.sizes[best][0] - body[0]) ? k : best), '8');
  return { era, body, todaySize };
}
/** One line of era guidance for the piece, or '' when the label is current. */
export function eraNote(system: string, size: string, year: number | null, line = '') {
  if (!year || system === 'One size' || !size) return '';
  if (system === 'US' && line !== 'Menswear') {
    const e = usEraEquivalent(size, year);
    if (e && e.todaySize !== String(size).trim()) return `A US ${size} from ${year} was cut for a ${e.body[0]} in bust (${e.era.source}): about a US ${e.todaySize} on today's chart.`;
  }
  if (['IT', 'FR', 'Letter', 'UK'].includes(system) && year < 1990) return `Labelled before 1990: European pieces of this age often fit one or two sizes smaller than the same number today. Go by the measurements.`;
  if (system === 'JP') return 'Japanese designer numbering (0-5) is set by each house; the conversion is a guide only.';
  if (['IT', 'FR'].includes(system) && year < 2007) return 'Made before the European size-labelling standard (EN 13402) was in use; the number follows the house block.';
  return '';
}
