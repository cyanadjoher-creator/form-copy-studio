import { DONE, CONTEXT_MISSING, now, readiness, type ContextResearch, type CopyControl, type Product, type Source } from './domain.ts';
import { sizeInches } from './sizing.ts';
import { canonicalListing, contextOnHold, rowNote, safeUrl, type ContextResult } from './context.ts';

const oneLine = (v: unknown, limit = 500) => typeof v === 'string' ? v.trim().replace(/\s+/g,' ').slice(0,limit) : '';
const scrub = (x: unknown, limit = 500) => oneLine(x,limit).replace(/\[CONTEXT MISSING[^\]]*\]/gi,'').trim();
const single = (value: string) => value.replace(/\.+$/,'').trim();
const stringList = (v: unknown) => Array.isArray(v) ? [...new Set(v.slice(0,24).map(x=>scrub(x)).filter(Boolean))] : [];
const approvedBefore = (p: Product) => !!p.copy && DONE.includes(p.status);

export function copyControl(p: Product): CopyControl {
  return p.copyControl || {history:'unreviewed',paragraph:'',header:'',photos:'unreviewed',blockers:[],contextOrigin:''};
}

export function reopenApproval(p: Product, reason: string) {
  if (approvedBefore(p)) {
    p.previousApproval = {status:p.status,copy:p.copy,boutiqueText:p.boutiqueText,sources:p.sources,care:p.care,at:now()};
    p.status = 'In review';
    p.history.push({t:now(), s:p.status, n:reason});
  }
}

export function photoChanged(p: Product) {
  reopenApproval(p,'Photo evidence changed; prior approval retained as a snapshot');
  const c=copyControl(p);
  p.flags=p.flags.filter(f=>!photoFlag({...p,flags:[f]}));
  p.copyControl={...c,photos:'unreviewed',history:p.copy?'unreviewed':c.history,blockers:p.copy?['Photo evidence changed. Check the set and regenerate before approval.']:[]};
}

export function photoFlag(p: Product, j: Record<string,unknown> = {}) {
  return j.photo_set_status === 'conflict' || [...p.flags,...stringList(j.flags)].some(s=>/mixed (?:photos|photo set|uploads)|photo (?:set )?discrepancy|photos?.*different garment|photos?.*wrong garment|does not match (?:the )?.{0,70} (?:skirt|jacket|garment)|photos?.*not (?:all|the) same garment/i.test(s));
}

export function checkedFacts(p: Product) {
  const clean = (k: keyof Product) => !p.conflicts[k] && !['desc','photos'].includes(p.fieldSrc[k] || '');
  const heldFibre = p.holds.some(s=>/^(fibre|fiber|composition|material)\s*:/i.test(s));
  const heldLining = p.holds.some(s=>/^lining\s*:/i.test(s));
  const heldCare = p.holds.some(s=>/^care\s*:/i.test(s));
  return {clean,heldFibre,heldLining,heldCare};
}
const fibres = /\b(?:virgin wool|wool(?:[- ]blend)?|silk|polyamide|polyester|cotton|nylon|viscose|cashmere|acrylic|elastane|linen|rayon)\b/gi;
const cleanHeld = (s: string, heldFibre: boolean, heldLining: boolean) => {
  if (heldLining && /\blining\b/i.test(s) && /\b(?:virgin wool|wool|silk|polyamide|polyester|cotton|nylon|viscose|cashmere|acrylic|elastane|linen|rayon|composition)\b/i.test(s)) return '';
  return heldFibre ? s.replace(/\b\d+(?:[.,]\d+)?%\s*/g,'').replace(fibres,'').replace(/\s+/g,' ').replace(/\s+([.,])/g,'$1').trim() : s;
};

export function applyDraft(p: Product, j: Record<string,unknown>, ctx: ContextResult, searchHits: string[], previousFlags: string[], research?: ContextResearch) {
  const previous = copyControl(p);
  const samePhotos = previous.photos === 'confirmed';
  const badSet = !samePhotos && photoFlag({...p,flags:previousFlags},j);
  const rec = ctx.record;
  const held = rec && contextOnHold(rec);
  const blockers: string[] = [];
  if (ctx.issue) blockers.push(ctx.issue);
  if (held) blockers.push('This tracker item is on hold. Resolve the hold in Copy Context before drafting.');
  if (badSet) blockers.push('The photos may show different items. Correct the set, or confirm it after checking every photo.');
  if (held || badSet || ctx.issue) {
    // Do not replace the existing draft or approval when the preconditions fail.
    reopenApproval(p,'Draft evidence requires review; previous approval retained');
    p.copyControl={...previous,history:'unreviewed',photos:badSet?'conflict':previous.photos,blockers,contextOrigin:ctx.origin,contextKey:rec?.key};
    p.flags=[...new Set([...blockers,...previousFlags,...stringList(j.flags)])];
    return p;
  }

  reopenApproval(p,'New generation needs review; previous approval retained');
  if (p.status !== 'In review') p.status='Drafted';
  const {clean,heldFibre,heldLining,heldCare} = checkedFacts(p);
  const exact = rec && !!rec.paragraph && rec.sources.length>0 && rec.itemSources.length>0 && !/^no verified history$/i.test(rec.historyStatus);
  // The boutique's own listing counts as item evidence, even when the search did not return it.
  const listing = safeUrl(rowNote(p,'Boutique Shop Link') || ((p.notes||'')+' '+(p.boutiqueDesc||'')).match(/https?:\/\/\S+/)?.[0] || '');
  const webHits=new Set([...searchHits,listing].map(canonicalListing).filter(Boolean));
  const reported = Array.isArray(j.sources) ? j.sources.flatMap(v=>{
    if (!v || typeof v!=='object') return [];
    const url=safeUrl(v.url), supports=scrub(v.supports);
    if (!url || !supports || !webHits.has(canonicalListing(url))) return [];
    return [{url,title:scrub(v.title)||url,supports,kind:v.evidence_role}];
  }) : [];
  // A researched paragraph becomes a CANDIDATE when at least one source was really found by the search.
  // It still has to be accepted (or omitted) by a person before approval.
  const web = reported.some(s=>searchHits.map(canonicalListing).includes(canonicalListing(s.url)));
  // The 'Research history' result is used when there is no tracker row.
  const researched = !exact && research && ['found','boutique'].includes(research.status) && research.paragraph ? research : null;
  const fromBoutique = !exact && !web && !researched ? scrub(j.history_from_boutique,2600) : '';
  // For an identified record use its proposed paragraph verbatim, never append its citations to a new model claim.
  const paragraph = exact ? scrub(rec.paragraph,2600) : researched ? scrub(researched.paragraph,2600) : web ? scrub(j.history_paragraph,2600) : fromBoutique;
  const evidence: Source[] = paragraph ? exact ? [...rec.sources,...rec.itemSources] : researched ? researched.sources : web ? reported.map(({kind:_kind,...rest})=>rest)
    : [{title:'Boutique description (unverified)', url:listing, supports:'Seller text only: verify before accepting'}] : [];
  p.sources=[...new Map(evidence.map(s=>[s.url||s.title,s])).values()];
  const history = paragraph ? 'candidate' : 'missing';
  if (researched?.status==='boutique') blockers.push('History taken from the boutique description only: check it against a source, then accept or omit it.');
  if (fromBoutique) blockers.push('History taken from the boutique description only: check it against a source, then accept or omit it.');

  const titleCandidates = [rec?.name,clean('name')?p.name:'',j.product_name,p.name];
  const name = titleCandidates.map(x=>cleanHeld(scrub(x),heldFibre,heldLining)).find(Boolean) || '';
  const brand = scrub(p.brand || rec?.brand).toUpperCase();
  const date = scrub(rec?.date || (clean('season') ? p.season : ''));
  const conflictingDate=!!rec?.date && clean('season') && p.season && p.season!=='Unknown' && p.season!==rec.date;
  if (conflictingDate) blockers.push('The Copy Context date and the checked item date disagree. Resolve the discrepancy before approval.');
  const header=[brand,name,!conflictingDate && date!=='Unknown'?date:''].filter(Boolean).join('\n');

  let product = single(cleanHeld(scrub(j.product_sentence),heldFibre,heldLining));
  if (!product) blockers.push('A supported material and garment sentence is missing. Draft it before approval.');
  const documentedWear = scrub(p.verifiedWear || p.condition);
  const wear = documentedWear.match(/\b(?:no visible|minimal|light|moderate|visible|significant|heavy) wear\b/i)?.[0] || '';
  // Never use a grade or unsupported model wear. The model supplies material and garment only.
  if (/\b(?:wear|worn|pristine|excellent condition)\b/i.test(product)) {
    product='';
    blockers.push('The generated product sentence contained unsupported condition wording. Confirm wear and draft the sentence again.');
  }
  if (product && wear && (p.verifiedWear || clean('condition'))) product += ' with '+wear.toLowerCase();
  const features = [...stringList(j.construction),...stringList(j.damage)].flatMap(s=>{
    const line=single(cleanHeld(s.replace(/^[·•-]\s*/,''),heldFibre,heldLining));
    return line && !/^(?:made in|care:|size\b|measurements?\b)/i.test(line) && !/\d\s*(cm|mm|inches|in\b)/i.test(line) ? [line] : [];
  });
  const measure = sizeInches(p.measurements || '',p.category);
  if (p.measurements && (!measure.text || measure.conflict)) blockers.push('Check the original measurement labels and units. Conflicting or unreadable measurements were omitted.');
  if (!p.name || !brand || !name) blockers.push('Confirm the brand and product name before approval.');
  const bullets=[...new Set(features),...(measure.text&&!measure.conflict?[measure.text]:[])].map(s=>'· '+s).join('\n');
  const country = clean('madeIn') && p.madeIn && !p.holds.some(x=>/^(made in|origin|manufacture)\s*:/i.test(x)) ? 'Made in '+single(scrub(p.madeIn).replace(/^made in\s+/i,''))+'.' : '';
  // With no history, the marker sits where the paragraph goes, so the gap is visible in the copy itself.
  p.copy=[header,paragraph||CONTEXT_MISSING,product?product+'.':'',bullets,country].filter(Boolean).join('\n\n');
  p.boutiqueText=heldCare||heldFibre||heldLining ? '' : scrub(j.boutique_text,2000);
  p.historyRow=rec?.row || null;
  p.copyControl={history,paragraph,header,photos:samePhotos?'confirmed':'unreviewed',blockers,contextOrigin:ctx.origin,contextKey:rec?.key};
  p.flags=[...new Set([...blockers,...stringList(j.flags),paragraph?'History draft needs editorial source review.':'Context missing: no source was found for the history. Add research (or a tracker row) and regenerate, or click Omit history.',rec?.note||'',rec?'History record matched · FORM tracker row '+(rec.tempId||rec.row)+' · '+rec.scope:''].filter(Boolean))];
  return p;
}

export function approveIssues(p: Product) {
  const r=readiness(p), c=copyControl(p), issues=[...c.blockers];
  if(r.missing.length) issues.push('missing '+r.missing.join(', '));
  if(r.conflicts.length) issues.push('conflicting '+r.conflicts.join(', '));
  if(r.tocheck.length) issues.push('check '+r.tocheck.join(', '));
  if(p.holds.length) issues.push('unresolved holds');
  if(c.photos==='conflict' || (c.photos!=='confirmed' && photoFlag(p))) issues.push('check the mixed photo set');
  if(!p.copy.trim() || p.copy.includes(CONTEXT_MISSING)) issues.push('finish the website draft');
  if(!['accepted','omitted','archive'].includes(c.history)) issues.push('review the history or explicitly record that it is omitted');
  if(c.history==='accepted' && (!c.paragraph || !p.copy.includes(c.paragraph) || !p.sources.length)) issues.push('history text and evidence do not match the reviewed paragraph');
  if(c.header && !p.copy.startsWith(c.header+'\n\n')) issues.push('restore the reviewed brand/name/date header');
  if(p.measurements && c.history!=='archive') {
    const expected=sizeInches(p.measurements,p.category);
    const final=p.copy.split('\n').filter(l=>l.startsWith('· ')).at(-1);
    if(expected.conflict || !expected.text || final!=='· '+expected.text) issues.push('correct the final quarter-inch size bullet');
  }
  return [...new Set(issues)];
}

export function copyForShopify(p: Product) {
  const c=copyControl(p);
  const blocks=p.copy.trim().split(/\n\s*\n/);
  const legacyHeader=blocks[0]?.split('\n') || [];
  const independentHeader = c.header || (legacyHeader[0]?.toUpperCase()===p.brand.toUpperCase() && legacyHeader.length>=2 ? blocks[0] : '');
  const [brand,name,date] = independentHeader.split('\n');
  const description=independentHeader && p.copy.startsWith(independentHeader+'\n\n') ? p.copy.slice(independentHeader.length).trim() : p.copy.trim();
  return {vendor:brand || p.brand, title:name || p.name, season_or_era:date || '', description, care:checkedFacts(p).heldCare || !checkedFacts(p).clean('care') ? '' : p.care};
}
