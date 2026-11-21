import { handle } from '@/lib/http';
import { getVocab, setVocab } from '@/lib/repo';

export const dynamic = 'force-dynamic';
export const PUT = handle(async (req: Request) => {
  const { key, value } = await req.json();
  await setVocab(key, value);
  return getVocab();
});
