import { handle } from '@/lib/http';
import { getProduct, activePrompt } from '@/lib/repo';
import { runModel } from '../_run';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const POST = handle(async (req: Request) => {
  const {id,text,rules}=await req.json();
  const p=await getProduct(id);
  const active=await activePrompt();
  const prompt=text===active.text && rules===active.rules ? active : {...active,text:String(text||''),rules:String(rules||'')};
  const r=await runModel(p,{fieldsOnly:false,dryRun:true,prompt});
  return {websiteCopy:r.blocked?'':r.product.copy,boutiqueText:r.blocked?'':r.product.boutiqueText,flags:r.product.flags};
});
