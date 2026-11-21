import { handle, HttpError } from '@/lib/http';
import { now } from '@/lib/domain';
import { addPrompt, listPrompts } from '@/lib/repo';

export const dynamic = 'force-dynamic';
export const GET = handle(async () => listPrompts());
export const POST = handle(async (req: Request) => {
  const { text, rules, note } = await req.json();
  if (!String(text || '').trim()) throw new HttpError(400, 'The prompt is empty');
  const v = await addPrompt(String(text), String(rules || ''), String(note || 'Edited'), now());
  return { v, prompts: await listPrompts() };
});
