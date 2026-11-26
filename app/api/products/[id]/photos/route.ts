import { createHash } from 'node:crypto';
import { handle, HttpError } from '@/lib/http';
import { MAX_PHOTOS, PHOTO_ROLES, now } from '@/lib/domain';
import { addPhoto, getProduct, saveProduct } from '@/lib/repo';
import { photoChanged } from '@/lib/copy-workflow';
import { savePhoto } from '@/lib/storage';

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = 'force-dynamic';

/** One photo per request (keeps each upload under Vercel's request size limit). */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const p = await getProduct(id);
  if (p.photos.length >= MAX_PHOTOS) throw new HttpError(400, `A product takes up to ${MAX_PHOTOS} photos`);
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'No photo received');
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new HttpError(400, 'Photos must be JPEG, PNG or WebP');
  if (file.size > 4 * 1024 * 1024) throw new HttpError(413, 'Photo too large (max 4 MB after resizing)');
  const role = String(form.get('role') || (p.photos.length ? 'Garment view' : 'Garment view'));
  if (!(PHOTO_ROLES as readonly string[]).includes(role)) throw new HttpError(400, 'Unknown photo role');
  const buf = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const url = await savePhoto(buf, file.type, `products/${id}/${sha256.slice(0, 16)}-${Date.now().toString(36)}.${ext}`);
  await addPhoto(id, { id: 'PH' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), url, role, sha256, position: p.photos.length });
  if (p.status === 'Imported') { p.status = 'Photographed'; p.history.push({ t: now(), s: 'Photographed', n: '' }); }
  photoChanged(p);
  return saveProduct(p);
});
