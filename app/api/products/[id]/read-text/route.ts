import { handle } from '@/lib/http';
import { readBoutiqueText } from '@/lib/domain';
import { getProduct, getVocab, saveProduct } from '@/lib/repo';

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = 'force-dynamic';

/** Re-reads the boutique description into empty fields (rules only, no AI). */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const p = await getProduct((await params).id);
  const filled = readBoutiqueText(p, await getVocab());
  return { product: await saveProduct(p), filled };
});
