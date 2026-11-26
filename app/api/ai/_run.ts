import { buildInput, parseModelJson, applyModelFields, hasRole, now, ROLE_LABEL, ROLE_CARE, type Product, type Prompt } from '@/lib/domain';
import { activePrompt, getVocab, saveProduct } from '@/lib/repo';
import { callModel, aiModel, aiProvider } from '@/lib/ai';
import { readPhoto } from '@/lib/storage';
import { HttpError } from '@/lib/http';
import { applyDraft, checkedFacts, copyControl, photoFlag, reopenApproval } from '@/lib/copy-workflow';
import { contextFor } from '@/lib/context-sheet';
import { contextOnHold } from '@/lib/context';

export async function runModel(p: Product, opts: { fieldsOnly: boolean; dryRun?: boolean; prompt?: Prompt }) {
  const priorFlags = [...p.flags];
  const [active, vocab] = await Promise.all([activePrompt(), getVocab()]);
  const prompt = opts.prompt || active;
  const ctx = opts.fieldsOnly ? {origin:'snapshot' as const} : await contextFor(p);
  const ctl = copyControl(p);
  const block = !opts.fieldsOnly && (ctx.issue || (ctx.record && contextOnHold(ctx.record)) || (ctl.photos !== 'confirmed' && (ctl.photos==='conflict' || photoFlag(p))));
  if (block) {
    applyDraft(p,ctl.photos==='conflict'?{photo_set_status:'conflict'}:{},ctx,[],priorFlags);
    return {product:opts.dryRun?p:await saveProduct(p),filled:[],blocked:true};
  }

  const images = await Promise.all(p.photos.map(async (ph, i) => {
    const { data, mime } = await readPhoto(ph.url);
    return { data: data.toString('base64'), mime, label: 'Photo '+(i+1)+' — '+ph.role };
  }));
  const webSearch = !opts.fieldsOnly && !ctx.record?.paragraph && aiProvider()==='claude' && process.env.WEB_SEARCH !== 'off';
  const { text, notes, searches, searchUrls=[] } = await callModel(buildInput(p,prompt,vocab,{...opts,webSearch,context:ctx}),images,{webSearch});
  let j: Record<string,unknown>;
  try { j=parseModelJson(text); } catch { throw new HttpError(502,'The model answer could not be read. No saved copy was replaced.'); }
  const fields = j.fields && typeof j.fields==='object' && !Array.isArray(j.fields) ? {...j.fields as Record<string,unknown>} : {};
  const mixed = ctl.photos!=='confirmed' && photoFlag(p,j);
  if (!opts.fieldsOnly && !mixed && (typeof j.product_sentence!=='string' || !j.product_sentence.trim() || !Array.isArray(j.construction))) throw new HttpError(502,'The generator did not return a usable structured draft. No saved copy was replaced.');
  const {heldFibre,heldCare}=checkedFacts(p);
  if (!hasRole(p,ROLE_LABEL)) delete fields.product_code;
  if (!hasRole(p,ROLE_CARE) || heldCare) delete fields.care_instructions;
  if (!hasRole(p,ROLE_LABEL) && !hasRole(p,ROLE_CARE)) delete fields.made_in;
  if (!hasRole(p,'Measurements')) delete fields.measurements;
  if (heldFibre) delete fields.material;
  delete fields.season_type; delete fields.season_year;
  const before = structuredClone(p);
  const filled = mixed ? [] : applyModelFields(p,fields);
  if (!opts.fieldsOnly) {
    if (filled.length || JSON.stringify(p.conflicts)!==JSON.stringify(before.conflicts)) {
      const snapshot = structuredClone(before);
      reopenApproval(snapshot,'New evidence and copy require review; prior approval retained');
      p.status=snapshot.status; p.previousApproval=snapshot.previousApproval; p.history=snapshot.history;
    }
    applyDraft(p,j,ctx,searchUrls,priorFlags);
    p.promptV=prompt.v;
  } else {
    if (filled.length || mixed || JSON.stringify(p.conflicts)!==JSON.stringify(before.conflicts)) {
      reopenApproval(p,'Photo reading changed the evidence; prior approval retained');
      if (before.copy) p.copyControl={...ctl,history:'unreviewed',blockers:['Check the updated photo evidence and regenerate before approval.']};
    }
    p.flags=[...new Set([...priorFlags,...(Array.isArray(j.flags)?j.flags.filter(x=>typeof x==='string'):[])])];
    if (mixed) p.copyControl={...copyControl(p),photos:'conflict',blockers:['The photos may show different garments. Check the complete set.']};
  }
  if (filled.length) p.flags.unshift('Filled from photos · check '+filled.join(', '));
  p.flags.push(...notes);
  p.history.push({t:now(),s:p.status,n:(opts.fieldsOnly?'Fields read':'Generated with prompt v'+prompt.v)+' · '+aiProvider()+' '+aiModel()+' · '+p.photos.length+' photos · '+searches+' web searches'});
  return {product:opts.dryRun?p:await saveProduct(p),filled,blocked:!!copyControl(p).blockers.length};
}
