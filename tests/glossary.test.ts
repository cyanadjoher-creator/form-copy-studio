import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptText, frozenTerm, guideFor, vocabularyBrief, GLOSSARY, FROZEN_VOCAB } from '../lib/glossary.ts';
import { blankProduct, toFrozen, DEFAULT_VOCAB, readBoutiqueText, normSeason } from '../lib/domain.ts';
import { approvalCheck, copySections, settleOnApproval } from '../lib/copy-workflow.ts';
import { CONTEXT_MISSING } from '../lib/domain.ts';

test('the frozen vocabulary is loaded as delivered', () => {
  assert.equal(FROZEN_VOCAB.COLOUR.length, 17);
  assert.deepEqual(FROZEN_VOCAB.CONDITION, ['Pristine', 'Excellent', 'Good', 'Fair', 'Poor']);
  assert(FROZEN_VOCAB.FASHION_HOUSE.includes('Maison Martin Margiela'));
  assert.deepEqual(DEFAULT_VOCAB.colours, FROZEN_VOCAB.COLOUR);
  // Every glossary term is listed once per group.
  for (const g of GLOSSARY) assert.equal(new Set(g.terms.map((t) => t.t.toLowerCase())).size, g.terms.length, g.key);
});

test('boutique field values move onto the frozen term, and ambiguous ones are left for a person', () => {
  assert.equal(frozenTerm('colours', 'Navy').term, 'Blue');
  assert.equal(frozenTerm('colours', 'gray').term, 'Grey');
  assert.equal(frozenTerm('colours', 'Beige').term, 'Beige / Tan');
  assert.deepEqual(frozenTerm('colours', 'Teal').choices, ['Blue', 'Green']);
  assert.equal(toFrozen('conditions', DEFAULT_VOCAB.conditions, 'New with tags').value, 'Pristine');
  assert.deepEqual(toFrozen('conditions', DEFAULT_VOCAB.conditions, 'Very good').choose, ['Excellent', 'Good']);
  assert.equal(toFrozen('brands', ['MAISON MARTIN MARGIELA'], 'MAISON MARGIELA').value, 'MAISON MARTIN MARGIELA');
  assert.equal(toFrozen('brands', [], 'Comme des Garcons').value, 'COMME DES GARÇONS');
  assert.equal(normSeason('Artisanal FW 2002').type, 'Artisanal');
});

test('the boutique text is read into frozen colours', () => {
  const p = blankProduct();
  Object.assign(p, { name: 'Navy wool coat', boutiqueDesc: 'Navy wool coat. Excellent condition.' });
  readBoutiqueText(p, DEFAULT_VOCAB);
  assert.equal(p.colour, 'Blue');
  assert.equal(p.condition, 'Excellent');
});

test('copy wording is adapted to FORM terms, and meaning changes are only suggested', () => {
  const a = adaptText('Zipper closure at center back · Gray color with ribbed cuffs — crew neck');
  assert.equal(a.text, 'Zip closure at centre back · Grey colour with rib-knit cuffs, crewneck');
  assert(a.changes.includes('zipper → zip'));
  const b = adaptText('Mandarin collar sweater');
  assert.equal(b.text, 'Mandarin collar sweater');
  assert.equal(b.suggestions.length, 2);
  assert.equal(adaptText('Sweatpants with drawstring').text, 'Sweatpants with drawstring');
});

test('the Copy Guide order is given per item type', () => {
  assert.deepEqual(guideFor('Shirts').order, ['Collar', 'Closure', 'Front', 'Hem', 'Shoulders', 'Cuffs', 'Sides', 'Back']);
  assert.equal(guideFor('Boots').type, 'Shoes');
  assert.equal(guideFor('Coats').fromGuide, false);
  const brief = vocabularyBrief('Bags');
  assert.match(brief, /Straps \/ Handle → Face/);
  assert.match(brief, /accessory: include the colour/);
  assert.match(brief, /zipper.*→ Zip/);
});

test('approval is open: soft checks can be approved past, hard checks cannot', () => {
  const p = blankProduct();
  Object.assign(p, { brand: 'HERMÈS', name: 'Wool Trousers', category: 'Trousers', copy: 'HERMÈS\nWool Trousers\n\n' + CONTEXT_MISSING + '\n\nWool trousers.\n\n· Belt loops' });
  p.copyControl = { history: 'missing', paragraph: '', header: 'HERMÈS\nWool Trousers', photos: 'unreviewed', blockers: [], contextOrigin: 'snapshot' };
  const c = approvalCheck(p);
  assert.equal(c.hard.length, 0, c.hard.join());
  assert(c.soft.some((x) => /history/.test(x)));
  settleOnApproval(p);
  assert(!p.copy.includes(CONTEXT_MISSING));
  assert.equal(p.copyControl?.history, 'omitted');
  assert(!approvalCheck(p).soft.some((x) => /review the history/.test(x)));
  p.conflicts = { colour: 'photos show Black' };
  assert(approvalCheck(p).hard.some((x) => /conflicting/.test(x)));
});

test('the product-page export splits the copy into the Copy Guide sections', () => {
  const p = blankProduct();
  const para = 'Jean Paul Gaultier designed womenswear at Hermès from Fall/Winter 2004.';
  Object.assign(p, { brand: 'HERMÈS', name: 'Wool Trousers', category: 'Trousers', material: '100% wool', sizeSystem: 'FR', size: '38',
    copy: `HERMÈS\nWool Trousers\nFall/Winter 2005\n\n${para}\n\nWool trousers.\n\n· Belt loops\n· Zip fly\n\nMade in France.` });
  p.copyControl = { history: 'accepted', paragraph: para, header: 'HERMÈS\nWool Trousers\nFall/Winter 2005', photos: 'confirmed', blockers: [], contextOrigin: 'snapshot' };
  const s = copySections(p);
  assert.equal(s.history, para);
  assert.equal(s.short, 'Wool trousers.');
  assert.equal(s.long, 'Belt loops\nZip fly');
  assert.equal(s.country, 'France');
  assert.equal(s.size, 'FR 38');
  assert.equal(s.season, 'Fall/Winter 2005');
  assert.match(s.html, /<li>Zip fly<\/li>/);
});

test('every piece is placed in a shop category, denim and sets first', async () => {
  const { shopCategoryFor } = await import('../lib/glossary.ts');
  assert.equal(shopCategoryFor({ category: 'Skirts', name: 'Indigo Denim Wrap Midi Skirt' }), 'Denim');
  assert.equal(shopCategoryFor({ category: 'Skirts', name: 'Blue Denim-Print Pareo Skirt' }), 'Skirts');
  assert.equal(shopCategoryFor({ category: 'Bags', name: 'Indigo Denim Harness Tote' }), 'Bags');
  assert.equal(shopCategoryFor({ category: 'Tops', name: 'Pink and Green Paisley Jacket and Skirt Set' }), 'Sets');
  assert.equal(shopCategoryFor({ category: 'Jewellery', name: 'Silver K&T Emerald Ring' }), 'Rings');
  assert.equal(shopCategoryFor({ category: 'Cardigans', name: 'Navy Hooded Cardigan' }), 'Knitwear');
  assert.equal(shopCategoryFor({ category: '', name: 'Mystery piece' }), '');
});

test('sizes convert by line and the US label is read in its era', async () => {
  const { convertSize, sizeIn, eraNote, usEraEquivalent } = await import('../lib/size-conversion.ts');
  const w = convertSize('IT', '40', 'Dresses', 'Womenswear');
  assert.equal(sizeIn(w, 'FR'), 'FR 38'); assert.equal(sizeIn(w, 'US'), 'US 4'); assert.equal(sizeIn(w, 'UK'), 'UK 8');
  const m = convertSize('IT', '48', 'Jackets', 'Menswear');
  assert.equal(sizeIn(m, 'US'), 'US 38');
  assert.equal(sizeIn(convertSize('IT', '48', 'Trousers', 'Menswear'), 'US'), 'US 32');
  assert.deepEqual(convertSize('IT', '40', 'Dresses', '')?.assumed, ['womenswear assumed (set the line)']);
  assert.equal(usEraEquivalent('8', 2002)?.todaySize, '6');
  assert.match(eraNote('US', '8', 2002), /about a US 6/);
  assert.equal(eraNote('US', '8', 2015), '');
  assert.match(eraNote('IT', '42', 1985), /before 1990/);
});
