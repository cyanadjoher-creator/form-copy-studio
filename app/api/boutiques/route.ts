import { handle, HttpError } from '@/lib/http';
import { uid } from '@/lib/domain';
import { listBoutiques, upsertBoutique } from '@/lib/repo';

export const dynamic = 'force-dynamic';
export const POST = handle(async (req: Request) => {
  const { name } = await req.json();
  if (!String(name || '').trim()) throw new HttpError(400, 'Name the boutique');
  await upsertBoutique({ id: uid('B'), name: String(name).trim(), imported: '' });
  return listBoutiques();
});
