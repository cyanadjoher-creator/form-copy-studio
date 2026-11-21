import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_VOCAB, applyModelFields, blankProduct, lint, normCode, normSeason, parseCSV, readBoutiqueText, readiness, shopifyGroup } from '../lib/domain.ts';

test('season labels are normalised to the house vocabulary', () => {
  assert.equal(normSeason('FW04').season, 'Fall/Winter 2004');
  assert.equal(normSeason('AW 2004').season, 'Fall/Winter 2004');
  assert.equal(normSeason('SS98').season, 'Spring/Summer 1998');
  assert.equal(normSeason('A/W2002').season, 'Fall/Winter 2002');
  assert.equal(normSeason('Early 2000s').season, '2000s');
  assert.equal(normSeason('1990s').type, 'Decade');
  assert.equal(normSeason('Resort 2010').season, 'Cruise / Resort 2010');
  assert.equal(normSeason('').season, 'Unknown');
});

test('boutique text fills empty fields only, and flags disagreements', () => {
  const p = blankProduct();
  Object.assign(p, { brand: 'COMME DES GARÇONS', name: 'Shirt', colour: 'Navy', boutiqueDesc: 'Cotton shirt in white with pointed collar. Size M. Good condition. Made in Japan. Chest 50 cm, length 70 cm.' });
  p.fieldSrc = { colour: 'file' };
  const filled = readBoutiqueText(p, DEFAULT_VOCAB);
  assert.deepEqual(filled.sort(), ['category', 'condition', 'madeIn', 'material', 'measurements', 'size'].sort());
  assert.equal(p.colour, 'Navy', 'never overwrites');
  assert.equal(p.conflicts.colour, 'boutique text says White');
  assert.equal(p.size, 'M'); assert.equal(p.sizeSystem, 'Letter');
  assert.equal(p.madeIn, 'Japan');
  assert.equal(p.measurements, 'Chest 50 cm, length 70 cm');
  const r = readiness(p);
  assert.ok(r.conflicts.includes('Colour'));
  assert.ok(r.missing.includes('Product code'));
});

test('several values in the text are not guessed', () => {
  const p = blankProduct();
  Object.assign(p, { name: 'Jacket', boutiqueDesc: 'Tweed wool jacket.' });
  readBoutiqueText(p, DEFAULT_VOCAB);
  assert.equal(p.material, '');
  assert.ok(p.flags.some((f) => f.includes('several materials')));
});

test('model fields: fill empty, conflict on disagreement, checked values are respected', () => {
  const p = blankProduct();
  p.colour = 'Black'; p.fieldSrc = { colour: 'manual' };
  const filled = applyModelFields(p, { colour: 'Navy', category: 'Jackets', product_code: 'NB123', care_instructions: 'Dry clean only.' });
  assert.deepEqual(filled.sort(), ['care', 'category', 'productCode'].sort());
  assert.equal(p.conflicts.colour, 'photos show Navy');
  const q = blankProduct(); q.colour = 'Black'; q.fieldSrc = { colour: 'checked' };
  applyModelFields(q, { colour: 'Navy' });
  assert.equal(q.conflicts.colour, undefined);
});

test('Shopify exports are merged by handle and HTML is stripped', () => {
  const g = shopifyGroup([['Handle', 'Title', 'Vendor', 'Body (HTML)', 'Image Src'], ['a', 'Jacket', 'Gucci', '<p>Wool &amp; silk</p>', 'x1.jpg'], ['a', '', '', '', 'x2.jpg'], ['b', 'Coat', 'Prada', '<p>x</p>', 'y.jpg']]);
  assert.equal(g.merged, true);
  assert.equal(g.rows.length, 3);
  assert.deepEqual(g.rows[1], ['a', 'Jacket', 'Gucci', 'Wool & silk', 'x1.jpg | x2.jpg']);
});

test('CSV with quotes and semicolons', () => {
  const rows = parseCSV('SKU;Name\n1;"Jacket; wool"\n');
  assert.deepEqual(rows, [['SKU', 'Name'], ['1', 'Jacket; wool']]);
});

test('house style check catches dashes, US spelling and the season line', () => {
  const p = blankProduct();
  p.copy = 'GUCCI\nKnit\nA/W2002\n\nA gray knit — soft.';
  const bad = lint(p).filter((c) => !c.ok).map((c) => c.label);
  assert.ok(bad.some((l) => l.startsWith('British spelling')));
  assert.ok(bad.includes('No em or en dashes'));
  assert.ok(bad.some((l) => l.startsWith('Season line')));
});

test('product codes match whatever the punctuation', () => {
  assert.equal(normCode('S30-AM 0123'), normCode('s30am0123'));
});
