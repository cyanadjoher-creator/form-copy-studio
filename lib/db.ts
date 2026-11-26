// Database access. Postgres on Vercel (DATABASE_URL / POSTGRES_URL, e.g. Neon from Vercel Storage);
// an embedded Postgres (PGlite) on disk when no URL is set, for local development.
import fs from 'node:fs';
import path from 'node:path';
import { seedIfEmpty } from './seed';

export type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

let ready: Promise<Query> | null = null;

export function dbKind(): string {
  try { return dbUrl() ? (isPreview() ? 'postgres (test)' : 'postgres') : 'local'; } catch { return 'missing test database'; }
}
/** Vercel previews must never write to the live database: they use TEST_DATABASE_URL or refuse to start. */
const isPreview = () => process.env.VERCEL_ENV === 'preview';
export function dbUrl(): string | undefined {
  if (isPreview()) {
    const t = process.env.TEST_DATABASE_URL || process.env.TEST_POSTGRES_URL;
    if (!t) throw new Error('This preview has no test database. Connect a separate Neon database to Preview with the prefix TEST (TEST_DATABASE_URL), then redeploy.');
    return t;
  }
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}
export const localRoot = () => (process.env.VERCEL ? '/tmp/form-copy-studio' : path.join(process.cwd(), '.data'));

export function db(): Promise<Query> {
  if (!ready) ready = init().catch((e) => { ready = null; throw e; });
  return ready;
}

async function init(): Promise<Query> {
  const url = dbUrl();
  let q: Query;
  if (url) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    q = (async (text: string, params: unknown[] = []) => (await sql.query(text, params)) as unknown[]) as Query;
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = process.env.PGLITE_DIR || path.join(localRoot(), 'pglite');
    fs.mkdirSync(dir, { recursive: true });
    const pg = new PGlite(dir);
    q = (async (text: string, params: unknown[] = []) => (await pg.query(text, params)).rows) as Query;
  }
  for (const stmt of SCHEMA) await q(stmt);
  await seedIfEmpty(q);
  return q;
}

const SCHEMA = [
  `create table if not exists boutiques (id text primary key, name text not null, imported text not null default '')`,
  `create table if not exists products (id text primary key, data jsonb not null, updated_at timestamptz not null default now())`,
  `create table if not exists photos (id text primary key, product_id text not null, url text not null, role text not null default 'Garment view', sha256 text not null, position int not null default 0, created_at timestamptz not null default now())`,
  `create index if not exists photos_product on photos(product_id)`,
  `create table if not exists prompts (v int primary key, body text not null, rules text not null default '', note text not null default '', created text not null default '', active boolean not null default false)`,
  `create table if not exists vocab (key text primary key, value jsonb not null)`,
  `create table if not exists refs (code text primary key, data jsonb not null)`,
  `create table if not exists photo_files (key text primary key, mime text not null, data text not null)`,
];
