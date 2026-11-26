import { handle } from '@/lib/http';
import { getProduct, saveProduct, activePrompt } from '@/lib/repo';
import { runResearch } from '@/lib/research';
import { now } from '@/lib/domain';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Research history: web research for one piece, saved on it for review. Does not touch the copy. */
export const POST = handle(async (req: Request) => {
  const { id } = await req.json();
  const p = await getProduct(id);
  p.contextResearch = await runResearch(p, await activePrompt());
  p.history.push({ t: now(), s: p.status, n: `history research: ${p.contextResearch.status} · ${p.contextResearch.searches} searches · ${p.contextResearch.sources.length} sources` });
  return { product: await saveProduct(p) };
});
