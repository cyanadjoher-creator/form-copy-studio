// Photo storage. Private Vercel Blob when BLOB_READ_WRITE_TOKEN is set (Vercel Storage → Blob);
// a local folder otherwise. Photos are always served through /api/files so they stay behind the login.
import fs from 'node:fs/promises';
import path from 'node:path';
import { localRoot } from './db';

export const storageKind = () => (process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'local');

export async function savePhoto(buf: Buffer, contentType: string, key: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    await put(key, buf, { access: 'private', contentType, addRandomSuffix: false, allowOverwrite: true });
  } else {
    const file = path.join(localRoot(), 'uploads', key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buf);
  }
  return '/api/files/' + key;
}

export async function deletePhotoFile(url: string) {
  if (!url.startsWith('/api/files/')) return;
  const key = url.slice('/api/files/'.length);
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) { const { del } = await import('@vercel/blob'); await del(key); }
    else await fs.unlink(path.join(localRoot(), 'uploads', key));
  } catch { /* already gone */ }
}

/** Bytes of a stored photo, for the model and for hashing. */
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
      const data = Buffer.from(await new Response(r.stream).arrayBuffer());
      return { data, mime: r.blob.contentType || 'image/jpeg' };
    }
    const data = await fs.readFile(path.join(localRoot(), 'uploads', key));
    return { data, mime: key.endsWith('.png') ? 'image/png' : 'image/jpeg' };
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('Photo not found: ' + url);
  return { data: Buffer.from(await res.arrayBuffer()), mime: res.headers.get('content-type') || 'image/jpeg' };
}
