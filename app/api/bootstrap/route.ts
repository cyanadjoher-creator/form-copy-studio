import { handle } from '@/lib/http';
import { listBoutiques, listProducts, listPrompts, listRefs, getVocab } from '@/lib/repo';
import { dbKind } from '@/lib/db';
import { storageKind } from '@/lib/storage';
import { aiModel, aiProvider } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const GET = handle(async () => {
  const [products, boutiques, vocab, refs, prompts] = await Promise.all([listProducts(), listBoutiques(), getVocab(), listRefs(), listPrompts()]);
  return { products, boutiques, vocab, refs, prompts, env: { database: dbKind(), storage: storageKind(), ai: aiProvider(), model: aiModel(), vercel: !!process.env.VERCEL } };
});
