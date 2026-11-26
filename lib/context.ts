import { HISTORY, type Product, type Source } from './domain.ts';

export type CopyContext = {
  key: string; boutique: string; tempId: string; supplierId: string; brand: string; name: string; date: string;
  row: number; copyStatus: string; historyStatus: string; scope: string; paragraph: string; note: string;
  sources: Source[]; itemSources: Source[];
};
export type ContextResult = { record?: CopyContext; origin: 'sheets' | 'snapshot' | 'unavailable'; issue?: string };
export const cleanId = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const comparableBrand = (s: string) => cleanId(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const stableKey = (boutique: string, id: string) => cleanId(boutique) && cleanId(id) ? [cleanId(boutique), cleanId(id)].join('|') : '';
export function safeUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try { const u = new URL(value); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : ''; }
  catch { return ''; }
}
export function canonicalListing(value: string) {
  const s = safeUrl(value);
  if (!s) return '';
  const u = new URL(s);
  return u.hostname.replace(/^www\./,'') + u.pathname.replace(/\/+$/,'');
}
const shopNames: Record<string,string> = { 'option.fashion':'option', 'elevated-archives.com':'elevated archives' };
export const rowNote = (p: Product, field: 'Temp ID' | 'Boutique Shop Link') => (p.notes || '').split(/\r?\n/).find(x=>x.startsWith(field+': '))?.slice(field.length+2).trim() || '';

function sources(input: unknown): Source[] {
  return Array.isArray(input) ? input.slice(0,20).flatMap(v => {
    if (!v || typeof v !== 'object') return [];
    const url = safeUrl(v.url);
    return url ? [{url, title: String(v.title || url).slice(0,300), supports: String(v.kind || v.supports || '').slice(0,350)}] : [];
  }) : [];
}

export function parseContextGrid(grid: unknown[][]): CopyContext[] {
  const keys = ['Match key','Boutique','Temp ID','Supplier product ID','Brand','Product name','Season or era','Copy status','History status','Evidence relationship','History paragraph','Editorial note','Source details JSON','Tracker row'];
  const header = (grid[0] || []).map(String);
  if (keys.some(k => !header.includes(k)) || new Set(header).size !== header.length) throw new Error('Copy Context headers do not match the expected contract.');
  return grid.slice(1).filter(r => r.some(x=>String(x??'').trim())).map(r => {
    const at = (k: string) => String(r[header.indexOf(k)] ?? '').trim();
    const boutique = at('Boutique'), tempId = at('Temp ID');
    const key = stableKey(boutique, tempId);
    if (!key || key !== at('Match key') || !at('Brand') || !at('Product name')) throw new Error('Copy Context contains an incomplete or inconsistent identity.');
    const detail = JSON.parse(at('Source details JSON') || '{}');
    return {
      key,boutique,tempId,supplierId:at('Supplier product ID'),brand:at('Brand'),name:at('Product name'),date:at('Season or era'),row:Number(at('Tracker row')),
      copyStatus:at('Copy status'),historyStatus:at('History status'),scope:at('Evidence relationship'),paragraph:at('History paragraph'),note:at('Editorial note'),
      sources:sources(detail.history_links),itemSources:sources(detail.item_links),
    };
  });
}

export function lookupContext(records: CopyContext[], p: Product, boutique: string, origin: 'sheets' | 'snapshot'): ContextResult {
  const listing = canonicalListing(p.listingUrl || rowNote(p,'Boutique Shop Link'));
  const shop = shopNames[listing.split('/')[0]];
  const normShop = cleanId(boutique);
  if (shop && shop !== normShop) return { origin, issue: 'The listing and the selected boutique disagree. Confirm the boutique and Temp ID before reusing history.' };
  const key = stableKey(boutique, p.tempId || rowNote(p,'Temp ID'));
  const supplier = cleanId(p.boutiqueRef);
  const byKey = records.filter(r=>key && r.key === key);
  const bySupplier = records.filter(r=>supplier && cleanId(r.boutique) === normShop && cleanId(r.supplierId) === supplier);
  const byListing = records.filter(r=>listing && cleanId(r.boutique) === normShop && r.itemSources.some(s=>canonicalListing(s.url || '') === listing));
  const matches = [...new Set([...byKey,...bySupplier,...byListing])];
  if (matches.length > 1) return { origin, issue: 'More than one Copy Context row matches these identifiers. Resolve the conflicting IDs before drafting.' };
  const record = matches[0];
  if (!record) return {origin};
  if (p.brand && comparableBrand(p.brand) !== comparableBrand(record.brand)) return {origin, issue:'The matched history record names a different brand. Check the item identity first.'};
  return {record,origin};
}

export const snapshotContext = (): CopyContext[] => HISTORY.flatMap(r=>{
  const site = r.item.map(x=>shopNames[canonicalListing(x.url).split('/')[0]]).find(Boolean);
  return site ? [{key:'',boutique:site,tempId:'',supplierId:'',brand:r.brand,name:r.name,date:r.date,row:r.row,
    copyStatus:r.status,historyStatus:'Needs review',scope:r.scope,paragraph:r.history,note:r.note,sources:sources(r.sources),itemSources:sources(r.item)}] : [];
});

export function contextOnHold(r: CopyContext) {
  return /hold|block/i.test(r.copyStatus) || /\bon hold\b/i.test(r.historyStatus);
}
