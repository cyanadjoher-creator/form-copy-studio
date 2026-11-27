import { handle, HttpError } from '@/lib/http';
import { blankProduct, canon, toFrozen, normSeason, now, readBoutiqueText, readiness, uid, type Product, GARMENT_CODE_MISSING } from '@/lib/domain';
import { getVocab, listBoutiques, saveProduct, upsertBoutique } from '@/lib/repo';

export const dynamic = 'force-dynamic';
const TRACKED = ['boutiqueRef', 'brand', 'name', 'category', 'colour', 'material', 'condition', 'size', 'madeIn', 'measurements', 'care', 'productCode'];

/** Imports mapped rows from a boutique file or a Shopify export. Rows arrive already mapped to FORM fields. */
export const POST = handle(async (req: Request) => {
  const body = (await req.json()) as { boutiqueId?: string; boutiqueName?: string; items: Record<string, string>[] };
  if (!Array.isArray(body.items) || !body.items.length) throw new HttpError(400, 'No rows to import');
  if (body.items.length > 2000) throw new HttpError(413, 'Import up to 2,000 rows at a time');
  const vocab = await getVocab();
  let boutiqueId = body.boutiqueId || '';
  const boutiques = await listBoutiques();
  if (body.items.every(o=>o.boutiqueName?.trim())) boutiqueId='B0';
  if (!boutiqueId || boutiqueId === 'new') {
    const name = String(body.boutiqueName || '').trim();
    if (!name) throw new HttpError(400, 'Name the boutique');
    const existing = boutiques.find((b) => b.name.toLowerCase() === name.toLowerCase());
    boutiqueId = existing?.id || uid('B');
    await upsertBoutique({ id: boutiqueId, name: existing?.name || name, imported: now() });
  } else {
    const b = boutiques.find((x) => x.id === boutiqueId);
    if (!b) throw new HttpError(400, 'Unknown boutique');
    await upsertBoutique({ ...b, imported: now() });
  }
  const known = await listBoutiques();
  const bname = known.find(b=>b.id===boutiqueId)?.name || '';
  let n = 0;
  for (const o of body.items) {
    if (!o.brand && !o.name) continue;
    const rowName = String(o.boutiqueName || '').trim();
    let rowId = boutiqueId;
    if (rowName) {
      let shop = known.find(b=>b.name.toLowerCase()===rowName.toLowerCase());
      if (!shop) { shop={id:uid('B'),name:rowName,imported:now()}; await upsertBoutique(shop); known.push(shop); }
      rowId = shop.id;
    }
    const p: Product = blankProduct(rowId);
    const ns = normSeason(o.seasonRaw);
    // Boutique wording is matched to the frozen vocabulary; where two frozen terms fit, the value stays as typed and a person picks.
    const adapted: string[] = [];
    const fz = (key: 'colours' | 'conditions' | 'brands', list: string[], raw: string, label: string) => {
      const r = toFrozen(key, list, raw);
      if (r.choose.length) adapted.push(`${label} "${raw}": closest frozen terms ${r.choose.join(' or ')}, pick one`);
      else if (raw && r.value && r.value.toLowerCase() !== raw.toLowerCase()) adapted.push(`${label} "${raw}" matched to the frozen term "${r.value}"`);
      return r.value;
    };
    Object.assign(p, {
      tempId:o.tempId||'',listingUrl:o.listingUrl||'',verifiedWear:o.verifiedWear||'',sku: o.sku || '', boutiqueRef: o.boutiqueRef || '', productCode: o.productCode || '', name: o.name || '',
      brand: o.brand ? fz('brands', vocab.brands, o.brand.toUpperCase(), 'Brand') : '',
      category: canon(vocab.categories, o.category || ''), colour: fz('colours', vocab.colours, o.colour || '', 'Colour'),
      material: canon(vocab.materials, o.material || ''), condition: fz('conditions', vocab.conditions, o.condition || '', 'Condition'),
      size: o.size || '', madeIn: o.madeIn || '', measurements: o.measurements || '', care: o.care || '', price: o.price || '',
      boutiqueDesc: o.boutiqueDesc || '',
      sizeSystem: Object.keys(vocab.sizes).find((s) => s.toLowerCase() === String(o.sizeSystem || '').trim().toLowerCase()) || '',
      notes: [o.listingTitle && 'Listing title: ' + o.listingTitle, o.photoFolder && 'Photo folder: ' + o.photoFolder, o.notes].filter(Boolean).join('\n'),
      research: [o.researchCollection && 'Collection: ' + o.researchCollection, o.researchLook && 'Look: ' + o.researchLook, o.research, o.researchLinks && 'Links: ' + o.researchLinks].filter(Boolean).join('\n'),
      teamFacts: o.teamFacts || '',
      seasonRaw: o.seasonRaw || '', season: ns.season, seasonType: ns.type, seasonYear: ns.yv, year: ns.year,
      history: [{ t: now(), s: 'Imported', n: 'from ' + (rowName || bname) }],
    });
    TRACKED.forEach((k) => { if (o[k]) p.fieldSrc[k] = 'file'; });
    if (!o.productCode) p.flags.push(GARMENT_CODE_MISSING);
    adapted.forEach((a) => p.flags.push('Vocabulary: ' + a));
    if (o.seasonRaw && ns.yv) p.fieldSrc.season = 'file';
    readBoutiqueText(p, vocab);
    p.needsInfo = readiness(p).missing.length > 0;
    await saveProduct(p);
    n++;
  }
  return { imported: n, boutiqueId };
});
