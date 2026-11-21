import { handle } from '@/lib/http';
import { addRefs, deleteRef, listRefs } from '@/lib/repo';
import type { Ref } from '@/lib/domain';

export const dynamic = 'force-dynamic';
export const POST = handle(async (req: Request) => {
  const { refs } = (await req.json()) as { refs: Ref[] };
  const added = await addRefs(refs || []);
  return { added, refs: await listRefs() };
});
export const DELETE = handle(async (req: Request) => {
  await deleteRef(new URL(req.url).searchParams.get('code') || '');
  return listRefs();
});
