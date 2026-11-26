import { handle } from '@/lib/http';
import { blankProduct, now, type Product } from '@/lib/domain';
import { listProducts, saveProduct } from '@/lib/repo';

export const dynamic = 'force-dynamic';
export const GET = handle(async () => listProducts());

/** Creates a product, blank (Ingestion → New product) or prefilled. */
export const POST = handle(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { product?: Partial<Product> };
  const p = { ...blankProduct(), ...(body.product || {}), status:'Imported', photos:[], history:[], sources:[], copyControl:undefined, revision:undefined, previousApproval:undefined } as Product;
  p.history = [...(p.history || []), { t: now(), s: p.status, n: 'created in Ingestion' }];
  return saveProduct(p);
});
