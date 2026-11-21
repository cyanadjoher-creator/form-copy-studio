// Photo storage. By default photos are stored in the database itself, so the only thing to connect
// on Vercel is the database. If a Vercel Blob store is ever connected (BLOB_READ_WRITE_TOKEN), it is used instead.
// Photos are always served through /api/files, so they stay behind the login.
import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from './db';

export const storageKind = () => (process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'database');

export async function savePhoto(buf: Buffer, contentType: string, key: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    await put(key, buf, { access: 'private', contentType, addRandomSuffix: false, allowOverwrite: true });
  } else {
    const q = await db();
    await q('insert into photo_files (key, mime, data) values ($1, $2, $3) on conflict (key) do update set mime = excluded.mime, data = excluded.data',
      [key, contentType, buf.toString('base64')]);
  }
  return '/api/files/' + key;
}

export async function deletePhotoFile(url: string) {
  if (!url.startsWith('/api/files/')) return;
  const key = url.slice('/api/files/'.length);
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) { const { del } = await import('@vercel/blob'); await del(key); }
    else { const q = await db(); await q('delete from photo_files where key = $1', [key]); }
  } catch { /* already gone */ }
}

/** Bytes of a stored photo, for display, hashing and the model. */
export async function readPhoto(url: string): Promise<{ data: Buffer; mime: string }> {
  if (url.startsWith('/seed/')) {
    const data = await fs.readFile(path.join(process.cwd(), 'public', url));
    return { data, mime: 'image/jpeg' };
  }
  if (url.startsWith('/api/files/')) {
    const key = url.slice('/api/files/'.length);
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { get } = await import('@vercel/blob');
      const r = await get(key, { access: 'private' });
      if (!r || r.statusCode !== 200) throw new Error('Photo not found: ' + key);
      return { data: Buffer.from(await new Response(r.stream).arrayBuffer()), mime: r.blob.contentType || 'image/jpeg' };
    }
    const q = await db();
    const [row] = await q<{ mime: string; data: string }>('select mime, data from photo_files where key = $1', [key]);
    if (!row) throw new Error('Photo not found: ' + key);
    return { data: Buffer.from(row.data, 'base64'), mime: row.mime };
  }
  throw new Error('Unknown photo location: ' + url);
}
