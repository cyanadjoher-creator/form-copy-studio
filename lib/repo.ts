import { randomUUID } from 'node:crypto';
import { SOUKITA_PROMPT } from './soukita-prompt';
// Data access. Products are stored as JSON documents (one row each) with photos in their own table,
// so the shape can evolve while the copy process is still being defined.
import { db } from './db';
import { DEFAULT_VOCAB, DONE, normCode, refKey, type Boutique, type Photo, type Product, type Prompt, type Ref, type Vocab } from './domain';
import { HttpError } from './http';
import { copyControl, photoFlag } from './copy-workflow';

type Row = { id: string; data: Product };
// Older rows may predate a field: fill it so the screens can rely on it.
const withDefaults = (d: Partial<Product>, id: string, photos: Photo[]): Product => ({ ...d, boutiqueRef: d.boutiqueRef ?? '', holds: d.holds ?? [], revision: d.revision ?? '', id, photos } as Product);

async function photosFor(ids: string[]): Promise<Record<string, Photo[]>> {
  const q = await db();
  if (!ids.length) return {};
  const rows = await q<Photo & { product_id: string }>('select id, product_id, url, role, sha256, position from photos where product_id = any($1) order by position, created_at', [ids]);
  const out: Record<string, Photo[]> = {};
  rows.forEach((r) => (out[r.product_id] ||= []).push({ id: r.id, url: r.url, role: r.role, sha256: r.sha256, position: r.position }));
  return out;
}

export async function listProducts(): Promise<Product[]> {
  const q = await db();
  const rows = await q<Row>('select id, data from products order by updated_at desc, id');
  const ph = await photosFor(rows.map((r) => r.id));
  return rows.map((r) => withDefaults(r.data, r.id, ph[r.id] || []));
}
export async function getProduct(id: string): Promise<Product> {
  const q = await db();
  const [row] = await q<Row>('select id, data from products where id = $1', [id]);
  if (!row) throw new HttpError(404, 'Product not found');
  const ph = await photosFor([id]);
  return withDefaults(row.data, id, ph[id] || []);
}
export async function saveProduct(p: Product): Promise<Product> {
  const q = await db();
  const { photos: _photos, ...data } = p;
  const encoded = JSON.stringify({...data,revision:randomUUID()});
  const changed = typeof p.revision === 'string'
    ? await q('update products set data = $2::jsonb, updated_at = now() where id = $1 and coalesce(data->>\'revision\',\'\') = $3 returning id', [p.id, encoded, p.revision])
    : await q('insert into products (id,data,updated_at) values ($1,$2::jsonb,now()) on conflict (id) do nothing returning id', [p.id,encoded]);
  if (!changed.length) throw new HttpError(409,'This item changed while you were working. Reload and retry; no draft was overwritten.');
  return getProduct(p.id);
}
export async function deleteProduct(id: string) {
  const q = await db();
  await q('delete from photos where product_id = $1', [id]);
  await q('delete from products where id = $1', [id]);
}

export async function addPhoto(productId: string, ph: Photo) {
  const q = await db();
  await q('insert into photos (id, product_id, url, role, sha256, position) values ($1,$2,$3,$4,$5,$6)', [ph.id, productId, ph.url, ph.role, ph.sha256, ph.position]);
}
export async function getPhoto(id: string): Promise<(Photo & { product_id: string }) | undefined> {
  const q = await db();
  const [r] = await q<Photo & { product_id: string }>('select * from photos where id = $1', [id]);
  return r;
}
export async function updatePhoto(id: string, role: string) { const q = await db(); await q('update photos set role = $2 where id = $1', [id, role]); }
export async function removePhoto(id: string) { const q = await db(); await q('delete from photos where id = $1', [id]); }

/** Soukita v42 rule: an exact match to a saved photo set (order-free, duplicates counted) of an approved entry. */
export async function findExactPhotoMatch(p: Product): Promise<Product | null> {
  if (!p.photos.length || p.holds.length || (copyControl(p).photos !== 'confirmed' && (copyControl(p).photos === 'conflict' || photoFlag(p)))) return null;
  const mine = p.photos.map(x=>x.sha256).sort().join();
  const same = (x:string|undefined,y:string|undefined)=>!!x?.trim() && x.trim().toLowerCase()===y?.trim().toLowerCase();
  const safe = (c: Product) => (!p.brand || same(p.brand,c.brand)) && !c.holds.length && !copyControl(c).blockers.length && (copyControl(c).photos==='confirmed' || !photoFlag(c)) && !c.copy.includes('[CONTEXT MISSING]');
  const all=(await listProducts()).filter(c=>c.id!==p.id && DONE.includes(c.status) && c.copy && safe(c));
  const records=all.filter(c=>c.photos.length===p.photos.length && c.photos.map(x=>x.sha256).sort().join()===mine);
  if (records.length && records.every(c=>c.copy===records[0].copy && c.boutiqueText===records[0].boutiqueText && JSON.stringify(c.sources)===JSON.stringify(records[0].sources))) return records[0];
  if (copyControl(p).photos !== 'confirmed' || p.boutiqueId === 'B0') return null;
  const ids = all.filter(c=>c.boutiqueId===p.boutiqueId && (same(c.tempId,p.tempId)||same(c.boutiqueRef,p.boutiqueRef)));
  return ids.length===1?ids[0]:null;
}

export async function listBoutiques(): Promise<Boutique[]> {
  const q = await db();
  return q<Boutique>('select id, name, imported from boutiques order by id');
}
export async function upsertBoutique(b: Boutique) {
  const q = await db();
  await q('insert into boutiques (id, name, imported) values ($1,$2,$3) on conflict (id) do update set name = excluded.name, imported = excluded.imported', [b.id, b.name, b.imported]);
}

export async function getVocab(): Promise<Vocab> {
  const q = await db();
  const rows = await q<{ key: string; value: unknown }>('select key, value from vocab');
  const v = { ...DEFAULT_VOCAB } as Record<string, unknown>;
  rows.forEach((r) => (v[r.key] = r.value));
  return v as Vocab;
}
export async function setVocab(key: string, value: unknown) {
  if (!(key in DEFAULT_VOCAB)) throw new HttpError(400, 'Unknown vocabulary: ' + key);
  const q = await db();
  await q('insert into vocab (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value', [key, JSON.stringify(value)]);
}

export async function listRefs(): Promise<Ref[]> {
  const q = await db();
  return (await q<{ data: Ref }>('select data from refs order by code')).map((r) => ({ boutiqueRef: '', ...r.data }));
}
export async function addRefs(refs: Ref[]) {
  const q = await db();
  // Keyed by the garment code, or by the boutique ID (prefixed B) when the garment code is not known yet.
  const existing = new Set((await listRefs()).map((r) => normCode(refKey(r))));
  let n = 0;
  for (const r of refs) {
    const code = String(r.code || '').trim(), boutiqueRef = String(r.boutiqueRef || '').trim();
    const key = refKey({ ...r, code, boutiqueRef });
    if (key === 'B' || existing.has(normCode(key))) continue;
    existing.add(normCode(key));
    await q('insert into refs (code, data) values ($1, $2::jsonb) on conflict do nothing', [key, JSON.stringify({ ...r, code, boutiqueRef })]);
    n++;
  }
  return n;
}
export async function deleteRef(code: string) { const q = await db(); await q('delete from refs where code = $1', [code]); }

export async function listPrompts(): Promise<Prompt[]> {
  const q = await db();
  const select = 'select v, body as text, rules, note, created, active from prompts order by v';
  const current=await q<Prompt>(select);
  if (!current.some(x=>x.v>2) && current.some(x=>x.v===2 && x.active && /v42 export/i.test(x.note))) {
    await q(`with retired as (
      update prompts set active=false where v=2 and active and note like '%v42 export%' and not exists(select 1 from prompts where v>2)
      returning rules
    ) insert into prompts (v,body,rules,note,created,active)
      select 3,$1,rules,'FORM reviewed workflow · evidence, wear and sizing',$2,true from retired
      on conflict (v) do nothing`,[SOUKITA_PROMPT,new Date().toISOString()]);
    return q<Prompt>(select);
  }
  return current;
}
export async function activePrompt(): Promise<Prompt> {
  const all = await listPrompts();
  const a = all.find((p) => p.active) || all[all.length - 1];
  if (!a) throw new HttpError(500, 'No prompt configured');
  return a;
}
export async function addPrompt(text: string, rules: string, note: string, created: string): Promise<number> {
  const q = await db();
  const [{ v }] = await q<{ v: number }>('select coalesce(max(v), 0) + 1 as v from prompts');
  await q('update prompts set active = false');
  await q('insert into prompts (v, body, rules, note, created, active) values ($1,$2,$3,$4,$5,true)', [v, text, rules, note, created]);
  return v;
}
export async function activatePrompt(v: number) {
  const q = await db();
  await q('update prompts set active = (v = $1)', [v]);
}
