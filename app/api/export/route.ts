import * as XLSX from 'xlsx';
import { handle } from '@/lib/http';
import { listProducts, listBoutiques } from '@/lib/repo';
import { DONE, now, type Product } from '@/lib/domain';
import { copySections } from '@/lib/copy-workflow';

export const dynamic = 'force-dynamic';

/** Product-page template: every validated piece, one row each, split into the Copy Guide sections.
 * ?scope=review adds pieces drafted or in review, for joint editing before approval. */
export const GET = handle(async (req: Request) => {
  const scope = new URL(req.url).searchParams.get('scope') || 'approved';
  const keep = (p: Product) => !!p.copy.trim() && (DONE.includes(p.status) || (scope === 'review' && ['Drafted', 'In review'].includes(p.status)));
  const [products, shops] = await Promise.all([listProducts(), listBoutiques()]);
  const shop = new Map(shops.map((b) => [b.id, b.name]));
  const head = ['Status', 'Brand', 'Title', 'Season or era', 'History', 'Short description', 'Long description', 'Country', 'Composition', 'Size', 'Care', 'Product code', 'Boutique SKU', 'Boutique', 'Category', 'Colour', 'Condition', 'Sources', 'Team facts', 'Shopify body (HTML)', 'Team edits / comments', 'Last update', 'Studio ID'];
  const rows = products.filter(keep).sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name)).map((p) => {
    const s = copySections(p);
    return [p.status, s.vendor, s.title, s.season, s.history, s.short, s.long, s.country, s.composition, s.size, s.care, p.productCode, p.sku, shop.get(p.boutiqueId) || '', p.category, p.colour, p.condition,
      p.sources.map((x) => [x.title, x.url].filter(Boolean).join(' ')).join('\n'), p.teamFacts || '', s.html, '', p.updated, p.id];
  });
  const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
  ws['!cols'] = head.map((h) => ({ wch: ['History', 'Long description', 'Shopify body (HTML)', 'Sources'].includes(h) ? 60 : ['Short description', 'Title', 'Team facts', 'Team edits / comments'].includes(h) ? 36 : 16 }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: head.length - 1 } }) };
  ws['!freeze'] = { xSplit: 3, ySplit: 1 };
  const readme = XLSX.utils.aoa_to_sheet([
    ['FORM Copy Studio · product-page export'],
    ['Exported ' + now() + ' · ' + rows.length + ' pieces · ' + (scope === 'review' ? 'approved, in review and drafted' : 'approved and in Shopify only')],
    [''],
    ['Columns follow the FORM Copy Guide order: History › Short description › Long description › Country › Composition › Size.'],
    ['Long description: one line per element, in the Copy Guide order for the item type. Size: label size, then the measurements in inches.'],
    ['Shopify body (HTML) is the same copy, ready to paste into the product description.'],
    ['Work on this file together (Google Sheets or Excel). Write changes and comments in "Team edits / comments"; the studio copy stays the reference until an edit is made in the studio.'],
    ['Studio ID links a row back to its piece in the copy studio.'],
  ]);
  readme['!cols'] = [{ wch: 120 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Product pages');
  XLSX.utils.book_append_sheet(wb, readme, 'Read me');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new Response(new Uint8Array(buf), { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="FORM_product_pages_${new Date().toISOString().slice(0, 10)}${scope === 'review' ? '_with_review' : ''}.xlsx"`,
  } });
});
