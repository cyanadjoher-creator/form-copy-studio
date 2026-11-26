import { copyControl, reopenApproval } from '@/lib/copy-workflow';
import { handle } from '@/lib/http';
import { readBoutiqueText } from '@/lib/domain';
import { getProduct, getVocab, saveProduct } from '@/lib/repo';

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = 'force-dynamic';

/** Re-reads the boutique description into empty fields (rules only, no AI). */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const p = await getProduct((await params).id);
  const before=structuredClone(p);
  const filled = readBoutiqueText(p, await getVocab());
  if (filled.length || JSON.stringify(p.conflicts)!==JSON.stringify(before.conflicts)) { reopenApproval(p,"Boutique evidence changed; review again"); if (p.copy) p.copyControl={...copyControl(p),history:"unreviewed",blockers:["Boutique evidence changed. Regenerate and review."]}; }
  return { product: await saveProduct(p), filled };
});
