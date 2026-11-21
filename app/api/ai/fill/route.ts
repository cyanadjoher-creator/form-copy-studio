import { handle } from '@/lib/http';
import { getProduct } from '@/lib/repo';
import { runModel } from '../_run';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const POST = handle(async (req: Request) => {
  const { id } = await req.json();
  return runModel(await getProduct(id), { fieldsOnly: true });
});
