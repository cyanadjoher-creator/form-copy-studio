import { handle, HttpError } from '@/lib/http';
import { DONE, now, readiness, type Product } from '@/lib/domain';
import { deleteProduct, getProduct, saveProduct } from '@/lib/repo';
import { deletePhotoFile } from '@/lib/storage';

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = 'force-dynamic';

export const GET = handle(async (_req: Request, { params }: Ctx) => getProduct((await params).id));

/** Saves edits. Approval is checked here too, so the rule holds whatever the client does. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const old = await getProduct(id);
  const body = (await req.json()) as { patch: Partial<Product>; note?: string };
  const next: Product = { ...old, ...body.patch, id, photos: old.photos, updated: now() };
  if (next.status !== old.status) {
    if (DONE.includes(next.status) && !DONE.includes(old.status)) {
      const r = readiness(next);
      const bits = [r.missing.length && `missing: ${r.missing.join(', ')}`, r.conflicts.length && `conflicts: ${r.conflicts.join(', ')}`, r.tocheck.length && `to check: ${r.tocheck.join(', ')}`].filter(Boolean);
      if (bits.length) throw new HttpError(409, 'Before approving - ' + bits.join(' · '));
      if (!next.copy.trim()) throw new HttpError(409, 'No copy to approve yet');
    }
    if (next.status === 'In Shopify' && old.status !== 'Approved' && old.status !== 'In Shopify') throw new HttpError(409, 'Approve before marking as in Shopify');
    next.history = [...(next.history || []), { t: now(), s: next.status, n: body.note || '' }];
  } else if (body.note) next.history = [...(next.history || []), { t: now(), s: next.status, n: body.note }];
  return saveProduct(next);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const p = await getProduct(id);
  await Promise.all(p.photos.map((ph) => deletePhotoFile(ph.url)));
  await deleteProduct(id);
  return { ok: true };
});
