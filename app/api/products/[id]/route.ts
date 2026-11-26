import { handle, HttpError } from '@/lib/http';
import { DONE, STAGES, now, type Product } from '@/lib/domain';
import { deleteProduct, getProduct, saveProduct } from '@/lib/repo';
import { deletePhotoFile } from '@/lib/storage';
import { approveIssues, copyControl, reopenApproval } from '@/lib/copy-workflow';

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = 'force-dynamic';
export const GET = handle(async (_req: Request, { params }: Ctx) => getProduct((await params).id));

const editable = ['sku','boutiqueRef','tempId','listingUrl','verifiedWear','productCode','boutiqueId','brand','name','category','colour','material','madeIn','measurements','care','season','seasonType','seasonYear','year','sizeSystem','size','condition','boutiqueDesc','notes','research','copy','boutiqueText','fieldSrc','conflicts','needsInfo','flags','holds'] as const;
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const {id}=await params;
  const old=await getProduct(id);
  const body=(await req.json()) as {patch?:Partial<Product>; note?:string; revision?:string; review?:'accept-history'|'omit-history'|'confirm-photos'};
  if (body.revision !== undefined && body.revision!==old.revision) throw new HttpError(409,'The item changed. Reload before saving.');
  const next=structuredClone(old);
  const patch=body.patch || {};
  const changed=editable.filter(k=>Object.hasOwn(patch,k) && JSON.stringify(patch[k])!==JSON.stringify(old[k]));
  if (patch.status && !STAGES.includes(patch.status)) throw new HttpError(400,'Invalid status.');
  const materialChange=changed.some(k=>!['needsInfo','flags'].includes(k));
  if (patch.status && DONE.includes(patch.status) && materialChange) throw new HttpError(409,'Save and review the new version before approving it.');
  if (materialChange) reopenApproval(next,'Item or copy changed; prior approval retained');
  for (const k of changed) (next as unknown as Record<string,unknown>)[k]=patch[k];
  const identity=changed.some(k=>['sku','boutiqueRef','tempId','listingUrl','verifiedWear','boutiqueId','brand','name','category','season','seasonYear'].includes(k));
  if (identity) {
    next.sources=[]; next.historyRow=null;
    if (next.copy) next.copyControl={...copyControl(next),history:'unreviewed',paragraph:'',header:'',blockers:['Item identity changed. Regenerate and review the new match before approval.']};
  } else if (changed.some(k=>['copy','research'].includes(k))) {
    const c=copyControl(next);
    next.copyControl={...c,history:next.copy===old.copy?c.history:'unreviewed'};
  }
  if (body.review) {
    const c=copyControl(next);
    if (DONE.includes(next.status)) throw new HttpError(409,'Reopen this item before changing its review decisions.');
    if (body.review==='confirm-photos') {
      if (!next.photos.length) throw new HttpError(409,'There are no photos to confirm.');
      next.copyControl={...c,photos:'confirmed',blockers:c.blockers.filter(b=>!/photos may show different/i.test(b))};
    } else if (body.review==='accept-history') {
      if (!c.paragraph || !next.sources.length || !next.copy.includes(c.paragraph)) throw new HttpError(409,'There is no matching sourced paragraph to accept.');
      next.copyControl={...c,history:'accepted'};
    } else if (body.review==='omit-history') {
      if (c.paragraph) next.copy=next.copy.split(/\n\s*\n/).filter(x=>x.trim()!==c.paragraph.trim()).join('\n\n');
      else if (c.history !== 'missing') throw new HttpError(409,'Regenerate or document an explicit history decision before omitting it.');
      next.sources=[];
      next.copyControl={...c,history:'omitted',paragraph:''};
    } else throw new HttpError(400,'Unknown review action.');
    next.history.push({t:now(),s:next.status,n:body.review});
  }
  if (patch.status && patch.status!==next.status) {
    if (patch.status==='In Shopify' && next.status!=='Approved') throw new HttpError(409,'Approve before marking as in Shopify.');
    if (DONE.includes(patch.status)) {
      const issues=approveIssues(next);
      if (issues.length) throw new HttpError(409,'Before approving · '+issues.join(' · '));
    }
    next.status=patch.status;
    next.history.push({t:now(),s:next.status,n:body.note||''});
  }
  if(!changed.length && !body.review && next.status===old.status) return old;
  next.updated=now();
  return saveProduct(next);
});

export const DELETE=handle(async (_req: Request,{params}:Ctx)=>{
  const {id}=await params;
  const p=await getProduct(id);
  await Promise.all(p.photos.map(ph=>deletePhotoFile(ph.url)));
  await deleteProduct(id);
  return {ok:true};
});
