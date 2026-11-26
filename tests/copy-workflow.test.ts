import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { blankProduct, DEFAULT_VOCAB, buildInput, guessField, normSeason, type Product } from '../lib/domain.ts';
import { sizeInches } from '../lib/sizing.ts';
import { contextOnHold, lookupContext, parseContextGrid, snapshotContext, type ContextResult } from '../lib/context.ts';
import { applyDraft, approveIssues, copyControl, copyForShopify, photoChanged } from '../lib/copy-workflow.ts';
import { fetchSheetRows } from '../lib/sheets-reader.ts';

const historical='https://archive.example/exhibition';
const listing='https://option.fashion/products/gucci-technical-skirt';
const grid=[
  ['Match key','Boutique','Temp ID','Supplier product ID','Brand','Product name','Season or era','Copy status','History status','Evidence relationship','History paragraph','Editorial note','Source details JSON','Tracker row'],
  ['option|op-7','Option','OP-7','10650460225802','GUCCI','Stone Grey Lace-Up Nylon Skirt','Spring/Summer 2010','Ready for review','Needs review','Collection comparison','Collection references illuminate the lacing construction.','This is a design comparison.',JSON.stringify({history_links:[{title:'Collection evidence',url:historical,kind:'Collection context'}], item_links:[{title:'Sale listing',url:listing,kind:'Exact item evidence'}]}),'58'],
];
const rows=parseContextGrid(grid);
const ctx:ContextResult={origin:'sheets',record:rows[0]};
const gucci=()=>Object.assign(blankProduct('B2'),{
  tempId:'OP-7', boutiqueRef:'10650460225802', listingUrl:listing, brand:'GUCCI', name:'Stone Grey Lace-Up Nylon Skirt', season:'Spring/Summer 2010',
  category:'Skirts', colour:'Grey', material:'Nylon', size:'40', condition:'Light wear', productCode:'TEST-42', measurements:'W33 x B43 x L52 cm', care:'Dry clean only.',
});
const draft={photo_set_status:'consistent',product_sentence:'Nylon skirt',product_name:'Fabrication',construction:['Lacing at waist'], damage:['Small mark at hem'], history_paragraph:'Invented show provenance.', sources:[],boutique_text:'Lacing closes at the waist.',flags:[]};
const missing:ContextResult={origin:'snapshot'};

test('original metric sizing beats supplier rounded inches and preserves width, ranges and order',()=>{
  assert.deepEqual(sizeInches('Chest 19.5 in, chest 49 cm, length 61 cm','Jackets'),{text:'C19.25 x L24 in',conflict:false});
  assert.equal(sizeInches('W33 x B43 x L52 cm','Skirts').text,'W13 x B17 x L20.5 in');
  assert.equal(sizeInches('W64 x L86-97 cm','Skirts').text,'W25.25 x L33.75-38.25 in');
  assert.equal(sizeInches('H27 x W26 x D11 cm','Bags').text,'H10.75 x W10.25 x D4.25 in');
  assert.equal(sizeInches('Waist 33 cm, hips 40 cm, length 52 cm','Skirts').text,'W13 x L20.5 in');
  assert.equal(sizeInches('Chest 49 cm, chest 51 cm','Jackets').conflict,true);
  assert.equal(sizeInches('Size IT 44','Jackets').text,'');
  assert.equal(normSeason('Circa 1994').season,'Circa 1994');
  assert.equal(normSeason('1990s to 2000s').season,'1990s to 2000s');
});

test('uses exact boutique-scoped identifiers, rejects mislabeled boutique, no fuzzy match',()=>{
  const p=gucci();
  assert.equal(lookupContext(rows,p,'Option','sheets').record?.row,58);
  assert.match(lookupContext(rows,p,'Elevated Archives','sheets').issue!,/disagree/);
  assert.equal(lookupContext(rows,{...p,listingUrl:'',tempId:'',boutiqueRef:'',historyRow:58},'Option','sheets').record,undefined);
  assert.match(lookupContext([...rows,...rows.map(r=>({...r}))],p,'Option','sheets').issue!,/More than one/);
  assert.equal(lookupContext(snapshotContext(),p,'Option','snapshot').record?.row,58);
  assert.equal(guessField('Temp ID'),'tempId');
  assert.equal(guessField('Boutique'),'boutiqueName');
  assert.equal(guessField('FORM description draft'),'');
});

test('read-only Sheet fetch validates headers and includes both kinds of evidence',async()=>{
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  const credential=JSON.stringify({client_email:'studio-test@example.test',private_key:privateKey.export({type:'pkcs8',format:'pem'})});
  let calls=0;
  const fake:typeof fetch=async(url,init)=>{
    calls++;
    if(calls===1){
      assert.equal(String(url),'https://oauth2.googleapis.com/token');
      const jwt=(init?.body as URLSearchParams).get('assertion')!;
      const claims=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString());
      assert.equal(claims.scope,'https://www.googleapis.com/auth/spreadsheets.readonly');
      return Response.json({access_token:'fake'});
    }
    assert.match(decodeURIComponent(String(url)),/Copy Context'!A1:R$/);
    assert.equal(new Headers(init?.headers).get('authorization'),'Bearer fake');
    return Response.json({values:grid});
  };
  const result=await fetchSheetRows('fake-testing-sheet-id',credential,fake);
  assert.equal(result[0].sources[0].url,historical);
  assert.equal(result[0].itemSources[0].url,listing);
  assert.throws(()=>parseContextGrid([['Brand']]),/headers/);
});

test('matches both sources and builds header, sourced paragraph, wear and final quarter inch bullet',()=>{
  const p=gucci();
  const input=buildInput(p,{text:'house',rules:''},DEFAULT_VOCAB,{context:ctx});
  assert(input.includes(historical) && input.includes(listing));
  applyDraft(p,draft,ctx,[],[]);
  assert.match(p.copy,/^GUCCI\nStone Grey Lace-Up Nylon Skirt\nSpring\/Summer 2010/);
  assert.match(p.copy,/Collection references illuminate the lacing construction/);
  assert.doesNotMatch(p.copy,/Invented/);
  assert.match(p.copy,/Nylon skirt with light wear\./);
  assert.match(p.copy,/· W13 x B17 x L20\.5 in$/);
  assert.equal(p.sources.length,2);
  assert.equal(copyControl(p).history,'candidate');
  assert(approveIssues(p).some(x=>x.includes('review the history')));
  p.copyControl!.history='accepted';
  assert.deepEqual(approveIssues(p),[]);
  const fields=copyForShopify(p);
  assert.equal(fields.vendor,'GUCCI');
  assert.equal(fields.title,'Stone Grey Lace-Up Nylon Skirt');
  assert.equal(fields.season_or_era,'Spring/Summer 2010');
  assert.doesNotMatch(fields.description,/^GUCCI|Care:/);
  assert.equal(fields.care,p.care);
});

test('regeneration reopens approval, snapshots old copy, removes old source links and keeps flags internal',()=>{
  const p=gucci();
  p.status='Approved'; p.copy='Old approved copy'; p.sources=[{title:'Old link',url:historical}];
  applyDraft(p,draft,missing,[],[]);
  assert.equal(p.status,'In review');
  assert.equal(p.previousApproval?.copy,'Old approved copy');
  assert.equal(p.previousApproval?.sources[0].url,historical);
  assert.deepEqual(p.sources,[]);
  assert.equal(copyControl(p).history,'missing');
  assert.doesNotMatch(p.copy,/Invented|Old approved/);
  // With no supported history, the gap is marked in the copy itself (26 Nov).
  assert.ok(p.copy.includes('[CONTEXT MISSING]') || copyControl(p).history==='candidate');
  p.copy=p.copy.replace('W13 x B17 x L20.5 in','W33 x B43 x L52 cm');
  assert(approveIssues(p).some(x=>x.includes('quarter-inch')));
  p.holds=['Lining: unreadable'];
  assert(approveIssues(p).includes('unresolved holds'));
});

test('blocks mixed photos and held tracker rows without replacing the copy',()=>{
  const mixed=gucci(); mixed.copy='Existing draft';
  applyDraft(mixed,{...draft,photo_set_status:'conflict'},ctx,[],[]);
  assert.equal(mixed.copy,'Existing draft');
  assert.equal(copyControl(mixed).photos,'conflict');
  assert(approveIssues(mixed).includes('check the mixed photo set'));
  mixed.flags.push('Possible photo discrepancy: photo 1 is different.');
  photoChanged(mixed);
  assert(!mixed.flags.some(x=>x.includes('discrepancy')));
  const p=gucci();
  const held={...ctx,record:{...rows[0],copyStatus:'Blocked - identity check'}};
  assert(contextOnHold(held.record));
  applyDraft(p,draft,held,[],[]);
  assert.equal(p.copy,'');
  assert.match(copyControl(p).blockers.join(' '),/on hold/);
});

test('approved wear comes from the dedicated reviewed field, not the seller grade',()=>{
  const p={...gucci(),condition:'Very good',verifiedWear:'Minimal wear'};
  applyDraft(p,draft,missing,[],[]);
  assert.match(p.copy,/Nylon skirt with minimal wear\./);
  assert.doesNotMatch(p.copy,/very good/);
});

test('label holds and unknown season stay out of the website output',()=>{
  const p=Object.assign(gucci(),{brand:'DOLCE & GABBANA',name:'Taupe Tweed Wool Jacket',category:'Jackets',measurements:'Chest 49 cm, length 61 cm',season:'Unknown',condition:'Very good',holds:['Fibre: unreadable','Lining: unreadable']});
  applyDraft(p,{...draft,product_sentence:'Wool tweed jacket',construction:['Silk lining','Flap pockets']},missing,[],[]);
  assert.match(p.copy,/^DOLCE & GABBANA\nTaupe Tweed Jacket\n\n/);
  assert.match(p.copy,/· C19\.25 x L24 in/);
  assert.doesNotMatch(p.copy,/wool|silk|very good|Unknown/i);
  assert(approveIssues(p).includes('unresolved holds'));
});

test('web proposals become a review candidate only with a page the search really found; invented links are dropped',()=>{
  const p=gucci();
  const result={...draft,history_paragraph:'Documented design context.',sources:[
    {title:'Collection',url:historical,supports:'The design decision',evidence_role:'collection'},
    {title:'Exact',url:listing,supports:'Sale garment and detail',evidence_role:'item'},
    {title:'Invented',url:'https://bogus.example',supports:'not real',evidence_role:'item'},
  ]};
  applyDraft(p,result,missing,[],[]);
  assert.equal(copyControl(p).history,'missing');
  assert.ok(p.copy.includes('[CONTEXT MISSING]'));
  applyDraft(p,result,missing,[historical],[]);
  assert.equal(copyControl(p).history,'candidate');
  assert.ok(!p.sources.some(s=>s.url==='https://bogus.example'));
  applyDraft(p,result,missing,[historical,listing],[]);
  assert.equal(copyControl(p).history,'candidate');
  assert.equal(p.sources.length,2);
});
