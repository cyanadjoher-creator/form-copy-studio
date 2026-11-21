import { handle, HttpError } from '@/lib/http';
import { PHOTO_ROLES } from '@/lib/domain';
import { getPhoto, getProduct, removePhoto, updatePhoto } from '@/lib/repo';
import { deletePhotoFile } from '@/lib/storage';

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = 'force-dynamic';

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const ph = await getPhoto(id);
  if (!ph) throw new HttpError(404, 'Photo not found');
  const { role } = await req.json();
  if (!(PHOTO_ROLES as readonly string[]).includes(role)) throw new HttpError(400, 'Unknown photo role');
  await updatePhoto(id, role);
  return getProduct(ph.product_id);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const ph = await getPhoto(id);
  if (!ph) throw new HttpError(404, 'Photo not found');
  await removePhoto(id);
  if (!ph.url.startsWith('/seed/')) await deletePhotoFile(ph.url);
  return getProduct(ph.product_id);
});
