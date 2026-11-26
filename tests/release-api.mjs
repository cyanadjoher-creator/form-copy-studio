// Run against a fresh localhost-only copy with AI_PROVIDER=mock and no remote database.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=new URL(process.argv[2]||'http://127.0.0.1:43131');
assert.equal(base.origin,'http://127.0.0.1:'+base.port,'Use an isolated IP-loopback localhost server only.');
let health;
for(let i=0;i<30;i++) {
  try {
    const r=await fetch(new URL('/api/health',base),{signal:AbortSignal.timeout(3000)});
    if(r.ok){health=await r.json(); break;}
  } catch {}
  await new Promise(r=>setTimeout(r,200));
}
assert(health && health.database==='local' && health.ai==='mock' && !health.vercel && health.storage==='database','Refused to test a non-local database, provider or photo store.');
async function fetchJson(route, body, method, code=200) {
  const r=await fetch(new URL(route,base),{
    method:method||(body===undefined?'GET':'POST'),
    ...(body===undefined?{}:body instanceof FormData?{body}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)}),
    signal:AbortSignal.timeout(25000),
  });
  const j=await r.json();
  assert.equal(r.status,code,route+' '+(j.error||''));
  return j;
}
const patch=(p,changes,expected=200)=>fetchJson('/api/products/'+p.id,{revision:p.revision,...changes},'PATCH',expected);
const good=await fetchJson('/api/products/P1001');
assert.equal(good.status,'Approved');
const clone=await fetchJson('/api/products',{});
for (const i of [4,2,6,1,5,3]) {
  const f=new FormData(),file='p1001-'+i+'.jpg';
  f.set('file',new Blob([await fs.readFile('public/seed/'+file)],{type:'image/jpeg'}),file);
  await fetchJson('/api/products/'+clone.id+'/photos',f);
}
const b=await fetchJson('/api/ai/generate',{id:clone.id});
assert.equal(b.matched,good.id);
assert.deepEqual([b.product.copy,b.product.boutiqueText,b.product.sources],[good.copy,good.boutiqueText,good.sources]);
console.log('PASS Balenciaga archive text, boutique copy and 2 citations preserved verbatim with shuffled exact photos.');

const d=await fetchJson('/api/ai/fill',{id:'P1000'});
assert.equal(d.product.photos.length,9);
assert(d.product.flags.some(f=>f.includes('Mock model saw 9 photo(s)') && f.includes('Care or composition label')));
const draft=await fetchJson('/api/ai/generate',{id:'P1000'});
assert.match(draft.product.copy,/· C19\.25 x L24 in/);
assert.doesNotMatch(draft.product.copy,/wool/i);
assert(draft.product.holds.length>=2);
assert.match((await patch(draft.product,{patch:{status:'Approved'}},409)).error,/unresolved holds/);
console.log('PASS D&G upload roles, held fibre and lining, corrected sizing, and enforced approval gate.');

const regenerate=await fetchJson('/api/ai/generate',{id:good.id});
assert.equal(regenerate.product.status,'In review');
assert.notEqual(regenerate.product.copy,good.copy);
assert.equal(regenerate.product.previousApproval.copy,good.copy);
assert.deepEqual(regenerate.product.previousApproval.sources,good.sources);
assert.deepEqual(regenerate.product.sources,[]);
assert.match((await patch(good,{patch:{notes:'Stale edit'}},409)).error,/changed/);
console.log('PASS approved regeneration opens review, preserves old snapshot, clears stale evidence and refuses stale edits.');

await fetchJson('/api/import',{boutiqueId:'B1', items:[
  {boutiqueName:'Option',tempId:'OP-7',brand:'GUCCI',name:'SS10 Nylon Technical Skirt',category:'Skirts',colour:'Grey',material:'Nylon',size:'40',condition:'Light wear',productCode:'DEMO-42',seasonRaw:'SS10',measurements:'W33 x B43 x L52 cm',listingUrl:'https://option.fashion/products/gucci-technical-skirt'},
  {boutiqueName:'Elevated Archives',tempId:'EL-3',brand:'DOLCE & GABBANA',name:'Taormina'},
]});
let items=await fetchJson('/api/products');
let p=items.find(x=>x.tempId==='OP-7'), other=items.find(x=>x.tempId==='EL-3');
assert(p && other && p.boutiqueId!==other.boutiqueId);
const wrong=await patch(p,{patch:{boutiqueId:other.boutiqueId}});
const denied=await fetchJson('/api/ai/generate',{id:wrong.id});
assert(denied.blocked && !denied.product.copy && denied.product.flags.some(x=>x.includes('boutique disagree')));
p=await patch(denied.product,{patch:{boutiqueId:p.boutiqueId}});
p=await patch(p,{patch:{flags:['Possible photo discrepancy: photos show a different garment.']}});
const mixed=await fetchJson('/api/ai/generate',{id:p.id});
assert(mixed.blocked && !mixed.product.copy && mixed.product.copyControl.photos==='conflict');
p=await patch(mixed.product,{patch:{flags:[]}});
console.log('PASS mixed-boutique import, wrong-boutique lookup and mixed-photo blockers.');

await fetchJson('/api/import',{boutiqueId:p.boutiqueId,items:[{
  boutiqueName:'Option', tempId:'OP-7-CLEAN-TEST',brand:'GUCCI',name:'SS10 Nylon Technical Skirt',category:'Skirts',colour:'Grey',material:'Nylon',size:'40',condition:'Light wear',productCode:'DEMO-42',seasonRaw:'SS10',measurements:'W33 x B43 x L52 cm',listingUrl:'https://option.fashion/products/gucci-technical-skirt',
}]});
items=await fetchJson('/api/products');
const fresh=items.find(x=>x.tempId==='OP-7-CLEAN-TEST');
const r=await fetchJson('/api/ai/generate',{id:fresh.id});
assert.equal(r.blocked,false);
assert.equal(r.product.historyRow,58);
assert.equal(r.product.copyControl.contextOrigin,'snapshot');
assert.equal(r.product.copyControl.history,'candidate');
assert.equal(r.product.sources.length,2);
assert.match(r.product.copy,/^GUCCI\nStone Grey Lace-Up Nylon Skirt\nSpring\/Summer 2010/);
assert.match(r.product.copy,/· W13 x B17 x L20\.5 in/);
await patch(r.product,{patch:{status:'Approved'}},409);
const review=await patch(r.product,{review:'accept-history'});
const approved=await patch(review,{patch:{status:'Approved'}});
assert.equal(approved.status,'Approved');
const prompt=await fetchJson('/api/prompts');
const active=prompt.find(x=>x.active);
const dry=await fetchJson('/api/ai/test',{id:approved.id,text:active.text,rules:active.rules});
assert.match(dry.websiteCopy,/W13 x B17 x L20\.5 in/);
assert.equal((await fetchJson('/api/products/'+approved.id)).revision,approved.revision);
console.log('PASS correctly identified Gucci generates a sized, sourced draft; explicit history review gates approval; test bench does not save.');
