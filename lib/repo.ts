// Data access. Products are stored as JSON documents (one row each) with photos in their own table,
// so the shape can evolve while the copy process is still being defined.
import { db } from './db';
import { DEFAULT_VOCAB, DONE, normCode, type Boutique, type Photo, type Product, type Prompt, type Ref, type Vocab } from './domain';
import { HttpError } from './http';

type Row = { id: string; data: Product };

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
  return rows.map((r) => ({ ...r.data, id: r.id, photos: ph[r.id] || [] }));
}
export async function getProduct(id: string): Promise<Product> {
  const q = await db();
  const [row] = await q<Row>('select id, data from products where id = $1', [id]);
  if (!row) throw new HttpError(404, 'Product not found');
  const ph = await photosFor([id]);
  return { ...row.data, id, photos: ph[id] || [] };
}
export async function saveProduct(p: Product): Promise<Product> {
  const q = await db();
  const { photos: _photos, ...data } = p;
  await q(`insert into products (id, data, updated_at) values ($1, $2::jsonb, now())
           on conflict (id) do update set data = excluded.data, updated_at = now()`, [p.id, JSON.stringify(data)]);
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
  if (!p.photos.length) return null;
  const mine = p.photos.map((x) => x.sha256).sort().join();
  const all = await listProducts();
  const cands = all.filter((x) => x.id !== p.id && DONE.includes(x.status) && x.copy && x.photos.length === p.photos.length)
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  return cands.find((c) => c.photos.map((x) => x.sha256).sort().join() === mine) || null;
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
  return (await q<{ data: Ref }>('select data from refs order by code')).map((r) => r.data);
}
export async function addRefs(refs: Ref[]) {
  const q = await db();
  const existing = new Set((await listRefs()).map((r) => normCode(r.code)));
  let n = 0;
  for (const r of refs) {
    const code = String(r.code || '').trim();
    if (!code || existing.has(normCode(code))) continue;
    existing.add(normCode(code));
    await q('insert into refs (code, data) values ($1, $2::jsonb) on conflict do nothing', [code, JSON.stringify({ ...r, code })]);
    n++;
  }
  return n;
}
export async function deleteRef(code: string) { const q = await db(); await q('delete from refs where code = $1', [code]); }

export async function listPrompts(): Promise<Prompt[]> {
  const q = await db();
  return q<Prompt>('select v, body as text, rules, note, created, active from prompts order by v');
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
