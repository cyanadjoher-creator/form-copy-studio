import { HttpError, handle } from '@/lib/http';
import { readPhoto } from '@/lib/storage';

type Ctx = { params: Promise<{ key: string[] }> };
export const dynamic = 'force-dynamic';

/** Serves stored photos to signed-in users (Blob is private). */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { key } = await params;
  const k = key.join('/');
  if (k.includes('..')) throw new HttpError(400, 'Bad path');
  const { data, mime } = await readPhoto('/api/files/' + k).catch(() => { throw new HttpError(404, 'Photo not found'); });
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': mime, 'Cache-Control': 'private, max-age=86400, immutable' } });
});
