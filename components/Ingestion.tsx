'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, useData } from './data';
import { cover, StagePill, useLightbox } from './ui';
import {
  DONE, FIELD_LABEL, MAX_PHOTOS, PHOTO_ROLES, REQUIRED, ROLE_CARE, ROLE_LABEL, blankProduct, hasRole, isEmptyField, lint, normSeason,
  readiness, refMatch, refNear, seasonCompose, titleCase, type Product, type Ref, type Stage, type Vocab } from '@/lib/domain';

import { approvalCheck, copyControl, copyForShopify } from '@/lib/copy-workflow';
const titleCaseShop = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

const EDIT_KEYS: (keyof Product)[] = ['sku', 'tempId', 'listingUrl', 'verifiedWear', 'boutiqueRef', 'productCode', 'boutiqueId', 'brand', 'name', 'category', 'colour', 'material', 'madeIn', 'measurements', 'care', 'season', 'seasonType', 'seasonYear', 'year', 'sizeSystem', 'size', 'condition', 'boutiqueDesc', 'notes', 'research', 'copy', 'boutiqueText', 'fieldSrc', 'conflicts', 'needsInfo', 'flags', 'holds'];
const pick = (p: Product) => Object.fromEntries(EDIT_KEYS.map((k) => [k, p[k]])) as Partial<Product>;
const QUEUES: [string, string, (p: Product) => boolean][] = [
  ['open', 'Open items', (p) => !DONE.includes(p.status)],
  ['review', 'In review', (p) => p.status === 'In review'],
  ['gaps', 'Missing or conflicting fields', (p) => { const r = readiness(p); return !!(r.missing.length || r.conflicts.length); }],
  ['check', 'Values to check', (p) => readiness(p).tocheck.length > 0],
  ['info', 'Needs info', (p) => p.needsInfo],
  ['all', 'All items', () => true],
];

/** Shrinks large photos like Soukita's tool (longest side 1,760 px, JPEG .88). Small JPEGs are sent untouched so exact matching works. */
async function preparePhoto(f: File): Promise<Blob> {
  const bmp = await createImageBitmap(f);
  const max = Math.max(bmp.width, bmp.height);
  if (f.type === 'image/jpeg' && max <= 1760 && f.size < 3.5 * 1024 * 1024) return f;
  const s = Math.min(1, 1760 / max);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not prepare the photo'))), 'image/jpeg', 0.88));
}

export function Ingestion({ id, brand }: { id?: string; brand?: string }) {
  const { data, setProduct, patch: patchData, toast } = useData();
  const router = useRouter();
  const lb = useLightbox();
  const [queue, setQueue] = useState(brand ? 'brand' : 'open');
  const [curId, setCurId] = useState<string | undefined>(id);
  const [p, setP] = useState<Product>(() => (id && data?.products.find((x) => x.id === id)) || blankProduct());
  const [busy, setBusy] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(p); latest.current = p;
  const fileRef = useRef<HTMLInputElement>(null);
  const isNew = !curId;

  // If the product list arrives after mount, pick the product up.
  useEffect(() => { if (id && data && p.id !== id) { const found = data.products.find((x) => x.id === id); if (found) setP(found); } }, [id, data, p.id]);

  const queueList = useMemo(() => {
    if (!data) return [];
    if (queue === 'brand' && brand) return data.products.filter((x) => x.brand === brand && !DONE.includes(x.status));
    const f = QUEUES.find((x) => x[0] === queue)?.[2] || QUEUES[0][2];
    return data.products.filter(f);
  }, [data, queue, brand]);

  /** Creates the product on first use (New product), then saves edits. */
  const persist = useCallback(async (): Promise<Product> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const cur = latest.current;
    let saved: Product;
    if (!curId) {
      saved = await api<Product>('/api/products', { body: { product: { ...pick(cur), id: cur.id } } });
      setCurId(saved.id);
      window.history.replaceState(null, '', '/ingestion/' + saved.id);
    } else {
      saved = await api<Product>('/api/products/' + cur.id, { method: 'PATCH', body: { patch: pick(cur), revision:cur.revision } });
    }
    if (latest.current === cur) { latest.current=saved; setP(saved); }
    else setP(prev=>({...prev,revision:saved.revision}));
    setProduct(saved);
    return saved;
  }, [curId, setProduct]);

  const schedule = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { persist().catch((e) => toast(e.message)); }, 700); };
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); persist().catch(() => {}); } }, [persist]);

  /** Edits a field by hand: it counts as checked and clears any conflict. */
  function edit(k: keyof Product, v: unknown, extra: Partial<Product> = {}) {
    setP((prev) => {
      const fieldSrc = { ...prev.fieldSrc }; const conflicts = { ...prev.conflicts };
      const key = k === 'seasonType' || k === 'seasonYear' ? 'season' : k === 'sizeSystem' ? 'size' : (k as string);
      if (FIELD_LABEL[key]) { fieldSrc[key] = 'manual'; delete conflicts[key]; }
      return { ...prev, [k]: v, ...extra, fieldSrc, conflicts };
    });
    schedule();
  }
  async function action<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(label);
    try { return await fn(); } catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setBusy(''); }
  }
  const take = (np: Product) => { latest.current=np; setP(np); setProduct(np); };

  async function upload(files: FileList | File[]) {
    const list = [...files].filter((f) => /^image\//.test(f.type)).slice(0, Math.max(0, MAX_PHOTOS - p.photos.length));
    if (!list.length) return toast(`A product takes up to ${MAX_PHOTOS} photos`);
    await action('upload', async () => {
      let cur = await persist();
      for (const f of list) {
        const blob = await preparePhoto(f);
        const form = new FormData();
        form.append('file', new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: blob.type || 'image/jpeg' }));
        form.append('role', 'Garment view');
        cur = await api<Product>(`/api/products/${cur.id}/photos`, { form });
      }
      take(cur); toast(`${list.length} photo${list.length > 1 ? 's' : ''} added`);
    });
  }
  async function setRole(phId: string, role: string) { await action('role', async () => { await persist(); take(await api<Product>('/api/photos/' + phId, { method: 'PATCH', body: { role } })); }); }
  async function removePhoto(phId: string) { await action('role', async () => { await persist(); take(await api<Product>('/api/photos/' + phId, { method: 'DELETE' })); }); }
  async function runAi(kind: 'fill' | 'generate' | 'research') {
    await action(kind, async () => {
      const cur = await persist();
      const r = await api<{ product: Product; filled?: string[]; matched?: string; blocked?: boolean }>('/api/ai/' + kind, { body: { id: cur.id } });
      take(r.product);
      if (kind === 'research') { const c = r.product.contextResearch; toast(c?.status === 'found' ? 'History found · review it below' : c?.status === 'boutique' ? 'Only the boutique\'s claim was found' : c?.status === 'error' ? 'Research failed · see the note' : 'Nothing documented found'); return; }
      toast(r.matched ? 'Approved copy loaded from the archive' : kind === 'fill' ? (r.filled?.length ? 'Filled: ' + r.filled.map((k) => FIELD_LABEL[k] || k).join(', ') : 'Nothing new to fill: see the notes') : r.blocked ? 'Draft needs a check · see To verify' : 'Draft ready');
    });
  }
  async function readText() {
    await action('read', async () => {
      const cur = await persist();
      const r = await api<{ product: Product; filled: string[] }>(`/api/products/${cur.id}/read-text`, { method: 'POST' });
      take(r.product);
      toast(r.filled.length ? 'Filled from the boutique text: ' + r.filled.map((k) => FIELD_LABEL[k]).join(', ') : 'Nothing new to fill: see the conflicts and notes');
    });
  }
  async function setStatus(s: Stage, acknowledge = false) {
    await action('status', async () => {
      const cur = await persist();
      const np = await api<Product>('/api/products/' + cur.id, { method: 'PATCH', body: { patch: { status: s }, revision:cur.revision, acknowledge } });
      take(np); toast(s);
      if (s === 'Approved') { const next = queueList.find((x) => x.id !== np.id && !DONE.includes(x.status)); if (next) router.push('/ingestion/' + next.id); }
    });
  }
  async function reviewCopy(review: 'confirm-photos' | 'accept-history' | 'omit-history') {
    await action('review',async()=>{
      const cur=await persist();
      take(await api<Product>('/api/products/'+cur.id,{method:'PATCH',body:{review,revision:cur.revision}}));
      toast(review==='confirm-photos'?'Photo set confirmed':review==='accept-history'?'History reviewed':'History omitted from the draft');
    });
  }

  function markChecked(k: string) {
    setP((prev) => { const conflicts = { ...prev.conflicts }; delete conflicts[k]; return { ...prev, fieldSrc: { ...prev.fieldSrc, [k]: 'checked' }, conflicts }; });
    schedule();
  }
  async function addRef(r: Ref) {
    const res = await api<{ refs: Ref[] }>('/api/refs', { body: { refs: [r] } });
    patchData((d) => ({ ...d, refs: res.refs })); toast('Added to the reference base');
  }
  const copy = (t: string, ok = 'Copied') => { if (!t) return toast('Nothing to copy yet'); navigator.clipboard.writeText(t).then(() => toast(ok), () => toast('Copy blocked by the browser')); };

  if (!data) return null;
  const v = data.vocab;
  const ac = approvalCheck(p);
  const r = readiness(p);
  const checks = lint(p);
  const idx = queueList.findIndex((x) => x.id === p.id);
  const activeV = data.prompts.find((x) => x.active)?.v;
  const tag = (k: string) => <FieldTag p={p} k={k} onOk={markChecked} />;

  return (
    <>
      <div className="row between">
        <div><div className="eyebrow">Ingestion · garment copy tool</div><h1 style={{ fontSize: 36 }}>Ingestion</h1></div>
        <div className="row"><span className="muted small">Active prompt</span><Link href="/prompt" className="pill p-mute" style={{ textDecoration: 'none' }}>v{activeV}</Link></div>
      </div>
      <div className="ws">
        <div className="card queue">
          <button className="btn dark" style={{ width: '100%', justifyContent: 'center', marginBottom: 10, padding: 10 }} onClick={() => { if (id) router.push('/ingestion'); else { if (timer.current) { clearTimeout(timer.current); persist().catch(() => {}); } setCurId(undefined); setP(blankProduct()); window.history.replaceState(null, '', '/ingestion'); } }}>+ New product</button>
          <select value={queue} onChange={(e) => setQueue(e.target.value)} style={{ marginBottom: 8 }}>
            {brand && <option value="brand">{titleCase(brand)} · open</option>}
            {QUEUES.map(([k, l, f]) => <option key={k} value={k}>{l} ({data.products.filter(f).length})</option>)}
          </select>
          {queueList.map((x) => (
            <div key={x.id} className={'qi' + (x.id === p.id ? ' on' : '')} onClick={() => router.push('/ingestion/' + x.id)}>
              {cover(x) && <img className="qthumb" src={cover(x)} alt="" />}
              <b>{x.name || 'Untitled'}</b><small>{titleCase(x.brand)} · {x.season}</small>
              <div style={{ marginTop: 4 }}><StagePill s={x.status} /></div>
            </div>
          ))}
          {!queueList.length && <p className="muted small">Nothing here.</p>}
        </div>

        <div className={'card' + (busy ? ' busy' : '')}>
          <div className="row between">
            <select value={p.boutiqueId} onChange={(e) => edit('boutiqueId', e.target.value)} style={{ width: 'auto', padding: '5px 8px', fontSize: 12.5 }} aria-label="Boutique">
              {data.boutiques.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {!isNew && idx >= 0 && <div className="row"><button className="btn sm ghost" disabled={idx <= 0} onClick={() => router.push('/ingestion/' + queueList[idx - 1].id)}>←</button><span className="mono small">{idx + 1} / {queueList.length}</span><button className="btn sm ghost" disabled={idx >= queueList.length - 1} onClick={() => router.push('/ingestion/' + queueList[idx + 1].id)}>→</button></div>}
          </div>
          <h2 style={{ margin: '8px 0 2px' }}>{isNew ? 'New product' : p.name || 'Untitled item'}</h2>
          {isNew
            ? <p className="small muted" style={{ margin: '0 0 6px' }}>Start with the photos (garment, brand label, care label), then <b>Fill fields from photos</b> and <b>Generate copy</b>. The product is saved as soon as you add a photo or type in a field.</p>
            : <div className="row" style={{ marginBottom: 6 }}><StagePill s={p.status} />{p.needsInfo && <span className="pill p-bad">needs info</span>}</div>}

          <h3 style={{ marginTop: 16 }}>Garment photos</h3>
          <div className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}
            onPaste={(e) => { const f = [...e.clipboardData.files]; if (f.length) { e.preventDefault(); upload(f); } }} tabIndex={0}>
            <button className="btn" onClick={() => fileRef.current?.click()}>Choose images</button><span className="muted small">or paste or drop them here · {p.photos.length} / {MAX_PHOTOS}</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = ''; }} />
          <div className="help">Photos here are for identification and copy. The product page photos stay in Shopify. Tag each one: the <b>Brand label</b> photo gives the product code, the <b>Care or composition label</b> photo gives composition and care. Click a photo to enlarge it.</div>
          <div className="thumbs">
            {p.photos.map((ph, j) => (
              <div key={ph.id} className={'thumb' + ([ROLE_LABEL, ROLE_CARE, 'Measurements'].includes(ph.role) ? ' m' : '')}>
                <img src={ph.url} alt={ph.role} style={{ cursor: 'zoom-in' }} onClick={() => lb.open(p, j)} />
                <button className="x" onClick={() => removePhoto(ph.id)} aria-label="Remove photo">×</button>
                <select className="mt" value={ph.role} onChange={(e) => setRole(ph.id, e.target.value)} aria-label="Photo role">{PHOTO_ROLES.map((x) => <option key={x}>{x}</option>)}</select>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 20 }}>Identification</h3>
          <ul className="checks" style={{ marginTop: 0 }}>
            <li className={p.productCode ? '' : 'no'}>{p.productCode ? 'Product code recorded' : 'Product code missing: read it from the brand label (the boutique ID does not count)'}</li>
            <li className={hasRole(p, ROLE_LABEL) ? '' : 'no'}>Brand label photo {hasRole(p, ROLE_LABEL) ? '' : 'missing'}</li>
            <li className={hasRole(p, ROLE_CARE) ? '' : 'no'}>Care label photo {hasRole(p, ROLE_CARE) ? '' : 'missing'}</li>
          </ul>
          <label className="f">Product code <span>as printed on the garment&apos;s brand label, not the boutique ID</span>{tag('productCode')}</label>
          <input type="text" value={p.productCode} onChange={(e) => edit('productCode', e.target.value)} placeholder="Style or model number" style={{ fontFamily: 'var(--mono)' }} />
          <RefBox p={p} refs={data.refs} onFill={(ref) => {
            const ns = normSeason(ref.season); const extra: Partial<Product> = {};
            if (isEmptyField(p, 'brand')) extra.brand = ref.brand;
            if (isEmptyField(p, 'name')) extra.name = ref.name;
            if (isEmptyField(p, 'category') && ref.category) extra.category = ref.category;
            if (isEmptyField(p, 'season')) Object.assign(extra, { season: ns.season, seasonType: ns.type, seasonYear: ns.yv, year: ns.year });
            setP((prev) => ({ ...prev, ...extra })); schedule(); toast(Object.keys(extra).length ? 'Filled from the reference' : 'No empty fields to fill');
          }} onUse={(code) => edit('productCode', code)} onAdd={() => addRef({ code: p.productCode.trim(), boutiqueRef: p.boutiqueRef || '', brand: p.brand, season: p.season, name: p.name, category: p.category, source: 'Added from ' + (p.sku || p.id), note: '' })} />
          <label className="f">Care instructions <span>shown on the product page</span>{tag('care')}</label>
          <textarea rows={2} value={p.care} onChange={(e) => edit('care', e.target.value)} placeholder="Read from the care label" />

          <h3 style={{ marginTop: 20 }}>Confirmed details</h3>
          <div className="grid g2" style={{ gap: '0 12px' }}>
            <div><label className="f">Boutique SKU</label><input type="text" value={p.sku} onChange={(e) => edit('sku', e.target.value)} style={{ fontFamily: 'var(--mono)' }} /></div>
            <div><label className="f">Boutique ID <span>listing or Shopify ID</span>{tag('boutiqueRef')}</label><input type="text" value={p.boutiqueRef || ''} onChange={(e) => edit('boutiqueRef', e.target.value)} style={{ fontFamily: 'var(--mono)' }} /></div>
            <div><label className="f">Brand{tag('brand')}</label><VSelect list={v.brands} value={p.brand} onChange={(x) => edit('brand', x)} brand /></div>
            <div><label className="f">Item name{tag('name')}</label><input type="text" value={p.name} onChange={(e) => edit('name', e.target.value)} /></div>
            <div style={{ gridColumn: '1/-1' }}><label className="f">Season{p.seasonRaw && p.seasonRaw !== p.season && <span>as supplied: {p.seasonRaw}</span>}{tag('season')}</label><SeasonSelect p={p} vocab={v} onChange={(t, yv) => edit('seasonType', t, { seasonYear: yv, season: seasonCompose(t, yv), year: parseInt(yv) || null })} /></div>
            <div><label className="f">Category{tag('category')}</label><VSelect list={v.categories} value={p.category} onChange={(x) => edit('category', x)} /></div>
            <div><label className="f">Colour{tag('colour')}</label><VSelect list={v.colours} value={p.colour} onChange={(x) => edit('colour', x)} /></div>
            <div><label className="f">Material{tag('material')}</label><VSelect list={v.materials} value={p.material} onChange={(x) => edit('material', x)} /></div>
            <div><label className="f">Condition{tag('condition')}</label><VSelect list={v.conditions} value={p.condition} onChange={(x) => edit('condition', x)} /></div>
            <div style={{ gridColumn: '1/-1' }}><label className="f">Size <span>system, then size</span>{tag('size')}</label>
              <div className="grid g2" style={{ gap: 8 }}>
                <select value={p.sizeSystem} onChange={(e) => edit('sizeSystem', e.target.value)} aria-label="Size system"><option value="">Size system</option>{Object.keys(v.sizes).map((s) => <option key={s}>{s}</option>)}</select>
                <VSelect list={v.sizes[p.sizeSystem] || []} value={p.size} onChange={(x) => edit('size', x)} placeholder="Size" />
              </div></div>
            <div style={{ gridColumn: '1/-1' }}><label className="f">Made in <span>verified only</span>{tag('madeIn')}</label><input type="text" value={p.madeIn} onChange={(e) => edit('madeIn', e.target.value)} /></div>
          </div>
          <label className="f">Measurements <span>go in the final bullet</span>{tag('measurements')}</label><input type="text" value={p.measurements} onChange={(e) => edit('measurements', e.target.value)} placeholder="H27 x W26 x D11 cm" />
          <label className="f">Tracker Temp ID</label><input value={p.tempId || ''} onChange={(e)=>edit('tempId',e.target.value)} placeholder="OP-7" />
          <label className="f">Original listing URL</label><input value={p.listingUrl || ''} onChange={(e)=>edit('listingUrl',e.target.value)} />
          <label className="f">Verified overall wear <span>from checked item evidence, not a seller grade</span></label>
          <input value={p.verifiedWear || ''} onChange={e=>edit('verifiedWear',e.target.value)} placeholder="Light wear" />
          <label className="f">Item notes <span>condition, approved tags, unmapped columns</span></label><textarea rows={2} value={p.notes} onChange={(e) => edit('notes', e.target.value)} />
          <label className="f">Research leads <span>archive link, collection name, look number</span></label><textarea rows={2} value={p.research} onChange={(e) => edit('research', e.target.value)} />
          <p className="small muted">Generate copy matches Copy Context against the boutique and item identifiers. A similar title is not proof of a match.</p>
          {p.copyControl?.contextOrigin && <p className="small">History from · {({ snapshot: 'FORM tracker (copy built into the site)', sheets: 'FORM tracker (live from Google)', unavailable: 'tracker not readable' } as Record<string, string>)[p.copyControl.contextOrigin] || p.copyControl.contextOrigin}{p.copyControl.contextKey ? ' · row ' + p.copyControl.contextKey.split('|').pop()!.toUpperCase() + ' (' + titleCaseShop(p.copyControl.contextKey.split('|')[0]) + ')' : ''}</p>}
          {!!p.sources.length && <><label className="f">Research sources</label><ul className="src">{p.sources.map((s, i) => <li key={(s.url || s.title) + i}><b>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}</b><br /><span className="muted">{s.supports}</span></li>)}</ul></>}
          {(() => { const c = p.contextResearch; const tracker = p.copyControl?.contextKey && p.copyControl?.history !== 'missing';
            return <div className="flag" style={{ marginTop: 14, borderColor: c?.status === 'found' ? undefined : undefined }}>
              <div className="row between"><b>History &amp; context</b><button className="btn sm" onClick={() => runAi('research')}>{busy === 'research' ? 'Researching… (up to 2 min)' : c ? 'Research again' : 'Research history'}</button></div>
              {tracker && <p className="small" style={{ margin: '6px 0 0' }}>This piece matches a FORM tracker row, so its reviewed history is used first.</p>}
              {!c ? <p className="small muted" style={{ margin: '6px 0 0' }}>Not researched yet. Research history searches the web for the house and the season given, then shows what it found here for you to review. Generate copy also runs it if needed.</p> : <>
                <p className="small" style={{ margin: '6px 0' }}><b>{c.status === 'found' ? 'History found' : c.status === 'boutique' ? 'Only the boutique description makes a claim (unverified)' : c.status === 'error' ? 'Research failed' : 'Nothing documented found'}</b> · {c.searches} web searches · {c.pages} pages · {c.at}</p>
                {c.paragraph && <p style={{ margin: '6px 0', fontStyle: 'italic' }}>{c.paragraph}</p>}
                {!!c.sources.length && <ul className="src" style={{ margin: '6px 0' }}>{c.sources.map((s, i) => <li key={(s.url || s.title) + i}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer"><b>{s.title}</b> ↗</a> : <b>{s.title}</b>}{s.supports && <><br /><span className="muted small">{s.supports}</span></>}</li>)}</ul>}
                {!!c.findings.length && <><span className="small muted">What the searches turned up:</span><ul className="small" style={{ margin: '4px 0 0', paddingLeft: 18 }}>{c.findings.map((f, i) => <li key={i}>{f}</li>)}</ul></>}
                {c.note && <p className="small muted" style={{ margin: '6px 0 0' }}>{c.note}</p>}
                <p className="small muted" style={{ margin: '6px 0 0' }}>Generate copy puts this into the draft as a proposal: edit it in the copy, accept it, or omit it. To steer it, add a team fact or a lead (look number, collection name, a link) and research again.</p>
              </>}
              <label className="f" style={{ marginTop: 10 }}>Team facts <span>what the team knows; used as confirmed input by Research and Generate</span></label>
              <textarea rows={2} value={p.teamFacts || ''} onChange={(e) => edit('teamFacts', e.target.value)} placeholder="e.g. Made during Jean Paul Gaultier's time at Hermès (2004-2011). Source: Cyana, label check." />
              <p className="small muted" style={{ margin: '4px 0 0' }}>Saved on this piece and logged in its History below. It does not reopen an approval; it shapes the next research and draft.</p>
            </div>; })()}
          <div className="row between" style={{ marginTop: 14 }}><label className="f" style={{ margin: 0 }}>Original boutique description</label><button className="btn sm ghost" onClick={readText}>Read into empty fields</button></div>
          <textarea rows={3} style={{ marginTop: 6 }} value={p.boutiqueDesc} onChange={(e) => edit('boutiqueDesc', e.target.value)} />
          <div className="grid g2" style={{ gap: 8, marginTop: 16 }}>
            <button className="btn" style={{ justifyContent: 'center', padding: 12 }} onClick={() => runAi('fill')}>{busy === 'fill' ? 'Reading the photos…' : 'Fill fields from photos'}</button>
            <button className="btn dark" style={{ justifyContent: 'center', padding: 12 }} onClick={() => runAi('generate')}>{busy === 'generate' ? 'Writing…' : 'Generate copy'}</button>
          </div>
          <div className="help">Photo evidence fills blank fields for review. Exact archived files, or a confirmed item with a verified photo set, can restore approved archive wording as a new local draft. Generating new copy never carries over approval.</div>
        </div>

        <div className={'card out' + (busy ? ' busy' : '')}>
          <div className="row between"><h2 style={{ margin: 0 }}>Website copy</h2><button className="btn sm ghost" onClick={() => copy(p.copy)}>Copy text</button></div>
          <textarea style={{ marginTop: 10 }} placeholder="Your draft will appear here." value={p.copy} onChange={(e) => edit('copy', e.target.value)} />
          <div className="row between" style={{ marginTop: 16 }}><h2 style={{ margin: 0, fontSize: 18 }}>Boutique text</h2><button className="btn sm ghost" onClick={() => copy(p.boutiqueText)}>Copy boutique text</button></div>
          <textarea style={{ marginTop: 10, minHeight: 120 }} placeholder="A short note on the design, history, wear and included items." value={p.boutiqueText} onChange={(e) => edit('boutiqueText', e.target.value)} />
          <div className="row between" style={{ marginTop: 16 }}><h2 style={{ margin: 0, fontSize: 18 }}>Care · product page</h2><button className="btn sm ghost" onClick={() => copy(p.care)}>Copy care</button></div>
          <div className="small" style={{ marginTop: 8, padding: '10px 12px', background: 'var(--soft)' }}>{p.care || <span className="muted">No care instructions yet. Add a care label photo and fill the fields, or type them in.</span>}</div>
          {(() => { const vocabF = p.flags.filter((f) => /^Vocabulary/.test(f)); const other = p.flags.filter((f) => !/^Vocabulary/.test(f));
            return <>
              {!!(other.length || (p.holds || []).length) && <div className="flag"><b>To verify</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {(p.holds || []).map((f, i) => <li key={'h' + f}><b>Held:</b> {f} <a href="#" className="small" onClick={(e) => { e.preventDefault(); edit('holds', (p.holds || []).filter((_, j) => j !== i)); }}>resolved</a></li>)}
                {other.map((f) => <li key={f}>{f}</li>)}</ul></div>}
              {!!vocabF.length && <div className="flag vocabnote"><b>FORM vocabulary</b> <span className="small muted">adapted automatically or suggested; nothing here blocks approval</span><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {vocabF.map((f) => <li key={f}>{f.replace(/^Vocabulary adapted to FORM terms:\s*/, 'Adapted: ').replace(/^Vocabulary suggestion:\s*/, 'Suggestion: ').replace(/^Vocabulary:\s*/, '')}</li>)}</ul>
                <a href="/vocabulary?v=glossary" className="small">Open the FORM glossary</a></div>}
            </>; })()}
          <div className="row">
            {p.photos.length>0 && copyControl(p).photos!=='confirmed' && !DONE.includes(p.status) && <button className="btn ghost" onClick={()=>reviewCopy('confirm-photos')}>Confirm all photos match</button>}
            {!!copyControl(p).paragraph && !DONE.includes(p.status) && <button className="btn ghost" onClick={()=>reviewCopy('accept-history')}>Accept sourced history</button>}
            {['candidate','missing'].includes(copyControl(p).history) && !DONE.includes(p.status) && <button className="btn ghost" onClick={()=>reviewCopy('omit-history')}>Omit history after review</button>}
          </div>
          <h3 style={{ marginTop: 16 }}>Before approval</h3>
          <ul className="checks" style={{ marginTop: 0 }}>
            <li className={r.missing.length ? 'no' : ''}>{r.missing.length ? 'Missing: ' + r.missing.join(', ') : 'No required field missing'}</li>
            {!!p.copy && <li className={['accepted','omitted','archive'].includes(copyControl(p).history)?'':'no'}>{copyControl(p).history==='accepted'?'History reviewed':copyControl(p).history==='omitted'?'History omitted after review':copyControl(p).history==='archive'?'History from the approved archive':copyControl(p).history==='candidate'?'History drafted · review sources':'No reviewed history paragraph'}</li>}
            {!!(p.holds || []).length && <li className="no">Held until confirmed: {(p.holds || []).map((x) => x.split(':')[0]).join(', ')}</li>}
            <li className={r.conflicts.length ? 'no' : ''}>{r.conflicts.length ? 'Conflicts: ' + r.conflicts.join(', ') : 'No conflict between sources'}</li>
            <li className={r.tocheck.length ? 'no' : ''}>{r.tocheck.length ? 'To check: ' + r.tocheck.join(', ') : 'Every filled-in value checked'}</li>
          </ul>
          {!!p.copy && !DONE.includes(p.status) && !!ac.hard.length && <p className="small" style={{ color: 'var(--bad-ink)' }}><b>Fix before approving:</b> {ac.hard.join(' · ')}</p>}
          {!!p.copy && !DONE.includes(p.status) && !!ac.soft.length && <p className="small muted"><b>Open checks</b> (you can approve past these; the approval records them): {ac.soft.join(' · ')}</p>}
          <h3 style={{ marginTop: 16 }}>House style check</h3>
          <ul className="checks">{checks.map((c) => <li key={c.label} className={c.ok ? '' : 'no'}>{c.label}</li>)}</ul>
          <div className="grid g2" style={{ marginTop: 16, gap: 8 }}>
            <button className="btn" style={{ justifyContent: 'center' }} onClick={() => setStatus('In review')}>Send to review</button>
            <button className="btn dark" style={{ justifyContent: 'center' }} onClick={() => setStatus('Approved', !ac.hard.length && !!ac.soft.length)}>{!ac.hard.length && ac.soft.length ? 'Approve with open checks' : 'Approve'}</button>
            <button className="btn ghost" style={{ justifyContent: 'center' }} onClick={() => edit('needsInfo', !p.needsInfo)}>{p.needsInfo ? 'Clear needs info' : 'Ask boutique for info'}</button>
            <button className="btn ghost" disabled={p.status!=='Approved'} style={{ justifyContent: 'center' }} onClick={() => setStatus('In Shopify')}>Mark as in Shopify</button>
          </div>
          {DONE.includes(p.status) && <details style={{ marginTop: 16 }}><summary>Shopify fields · copy individually</summary>
            {Object.entries(copyForShopify(p)).map(([key,value])=><div key={key} className="row between" style={{marginTop:6}}><span>{key.replace(/_/g,' ')}</span><button className="btn sm ghost" disabled={!value} onClick={()=>copy(value)}>Copy {key.replace(/_/g,' ')}</button></div>)}
          </details>}
          {p.previousApproval && <details style={{marginTop:12}}><summary>Previous approval · {p.previousApproval.at}</summary><pre className="code">{p.previousApproval.copy}</pre></details>}
          {!isNew && <><h3 style={{ marginTop: 18 }}>History</h3><div className="hist">{[...p.history].reverse().map((h, i) => <div key={i}>{h.t} · {h.s}{h.n ? ' · ' + h.n : ''}</div>)}</div></>}
        </div>
      </div>
      {lb.node}
    </>
  );
}

function FieldTag({ p, k, onOk }: { p: Product; k: string; onOk: (k: string) => void }) {
  const src = p.fieldSrc?.[k], cf = p.conflicts?.[k];
  if (cf) return <button type="button" className="ftag bad" onClick={() => onOk(k)} title="Correct the field, or click to keep the current value">conflict: {cf} · keep current ✓</button>;
  if (isEmptyField(p, k)) return REQUIRED.includes(k) ? <span className="ftag miss">missing</span> : null;
  if (src === 'desc' || src === 'photos') return <button type="button" className="ftag warn" onClick={() => onOk(k)} title="Click once you have checked it">{src === 'desc' ? 'from boutique text' : 'from photos'} · check ✓</button>;
  if (src === 'file') return <span className="ftag">from boutique file</span>;
  if (src === 'checked') return <span className="ftag ok">checked</span>;
  return null;
}

/** Dropdown on a vocabulary list; a value outside the list shows in orange. */
function VSelect({ list, value, onChange, brand, placeholder = 'Choose' }: { list: string[]; value: string; onChange: (v: string) => void; brand?: boolean; placeholder?: string }) {
  const off = !!value && !list.includes(value);
  return (
    <select className={off ? 'off' : ''} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {list.map((x) => <option key={x} value={x}>{brand ? titleCase(x) : x}</option>)}
      {off && <option value={value}>{value} · off-list</option>}
    </select>
  );
}

function SeasonSelect({ p, vocab, onChange }: { p: Product; vocab: Vocab; onChange: (t: string, yv: string) => void }) {
  const t = p.seasonType || 'Unknown';
  const years: string[] = []; for (let y = new Date().getFullYear(); y >= 1947; y--) years.push(String(y));
  const decs: string[] = []; for (let d = 2020; d >= 1940; d -= 10) decs.push(d + 's');
  const opts = t === 'Decade' ? decs : years;
  return (
    <div className="grid g2" style={{ gap: 8 }}>
      <select value={t} className={vocab.seasonTypes.includes(t) ? '' : 'off'} aria-label="Season type" onChange={(e) => {
        const nt = e.target.value; let yv = p.seasonYear;
        if (nt === 'Decade' && yv && !/s$/.test(yv)) yv = Math.floor(+yv / 10) * 10 + 's';
        if (nt !== 'Decade' && /s$/.test(yv)) yv = '';
        onChange(nt, yv);
      }}>{vocab.seasonTypes.map((x) => <option key={x}>{x}</option>)}{!vocab.seasonTypes.includes(t) && <option>{t}</option>}</select>
      <select value={p.seasonYear} aria-label="Year" onChange={(e) => onChange(t, e.target.value)}><option value="">{t === 'Decade' ? 'Decade' : 'Year'}</option>{opts.map((y) => <option key={y}>{y}</option>)}</select>
    </div>
  );
}

function RefBox({ p, refs, onFill, onUse, onAdd }: { p: Product; refs: Ref[]; onFill: (r: Ref) => void; onUse: (code: string) => void; onAdd: () => void }) {
  if (!p.productCode) return null;
  const r = refMatch(refs, p.productCode);
  if (r) return (
    <div className="flag" style={{ background: 'var(--ok-pill)', borderColor: 'var(--ok)' }}>
      <b>In the reference base</b> · {titleCase(r.brand)} · {r.season} · {r.name}{r.category ? ' · ' + r.category : ''}
      <div className="row" style={{ marginTop: 8 }}><button className="btn sm" onClick={() => onFill(r)}>Fill empty fields from the reference</button>
        {(r.brand !== p.brand || (r.season && r.season !== p.season)) && <span className="small" style={{ color: 'var(--bad-ink)' }}>Brand or season differs from the record: check</span>}</div>
    </div>
  );
  const near = refNear(refs, p.productCode);
  return (
    <div className="flag">
      {near.length ? <><b>No exact match.</b> Close codes: {near.map((x, i) => <span key={x.code}>{i ? ', ' : ''}<a href="#" className="mono" onClick={(e) => { e.preventDefault(); onUse(x.code); }}>{x.code}</a> ({titleCase(x.brand)})</span>)}</> : <b>Not in the reference base yet.</b>}
      <div style={{ marginTop: 8 }}><button className="btn sm" onClick={onAdd}>Add this code to the reference base</button></div>
    </div>
  );
}
