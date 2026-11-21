import { handle } from '@/lib/http';
import { activatePrompt, listPrompts } from '@/lib/repo';

type Ctx = { params: Promise<{ v: string }> };
export const dynamic = 'force-dynamic';
export const PATCH = handle(async (_req: Request, { params }: Ctx) => {
  await activatePrompt(Number((await params).v));
  return listPrompts();
});
