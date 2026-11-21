'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, useData } from '@/components/data';
import { VOCAB_LISTS, type Product, type Vocab } from '@/lib/domain';

export default function Page() { return <Suspense><VocabularyView /></Suspense>; }

function VocabularyView() {
  const { data, patch, toast } = useData();
  const [key, setKey] = useState<keyof Vocab>((useSearchParams().get('v') as keyof Vocab) || 'brands');
  const [term, setTerm] = useState('');
  const [newSys, setNewSys] = useState('');
  if (!data) return null;
  const def = VOCAB_LISTS.find((x) => x.key === key) || VOCAB_LISTS[0];
  async function save(k: keyof Vocab, value: unknown) {
    try { const vocab = await api<Vocab>('/api/vocab', { method: 'PUT', body: { key: k, value } }); patch((d) => ({ ...d, vocab })); }
    catch (e) { toast((e as Error).message); }
  }
  const field = def.field as keyof Product | null;
  const count = (t: string) => (field ? data.products.filter((p) => p[field] === t).length : 0);

  let body: React.ReactNode;
  if (key === 'sizes') {
    const sizes = data.vocab.sizes;
    body = (
      <>
        {Object.entries(sizes).map(([sys, vals]) => (
          <div key={sys} style={{ padding: '12px 0', borderBottom: '1px solid var(--rule-2)' }}>
            <div className="row between"><b>{sys}</b><button className="btn sm ghost" onClick={() => { const n = { ...sizes }; delete n[sys]; save('sizes', n); }}>Remove system</button></div>
            <div style={{ marginTop: 8 }}>{vals.map((v) => <span key={v} className="vchip">{v}<button aria-label={'Remove ' + v} onClick={() => save('sizes', { ...sizes, [sys]: vals.filter((x) => x !== v) })}>×</button></span>)}</div>
            <input type="text" placeholder={`Add a size to ${sys}, press Enter`} style={{ width: 260, marginTop: 4 }} onKeyDown={(e) => { const t = e.currentTarget.value.trim(); if (e.key === 'Enter' && t) { save('sizes', { ...sizes, [sys]: [...vals, t] }); e.currentTarget.value = ''; } }} />
          </div>
        ))}
        <div className="row" style={{ marginTop: 16 }}><input type="text" value={newSys} onChange={(e) => setNewSys(e.target.value)} placeholder="New size system, e.g. Shoes UK" style={{ width: 260 }} /><button className="btn sm" onClick={() => { if (newSys.trim() && !sizes[newSys.trim()]) { save('sizes', { ...sizes, [newSys.trim()]: [] }); setNewSys(''); } }}>Add system</button></div>
      </>
    );
  } else {
    const list = data.vocab[key] as string[];
    const add = (raw: string) => { const t = key === 'brands' || key === 'archiveBrands' ? raw.trim().toUpperCase() : raw.trim(); if (!t) return; if (list.includes(t)) return toast('Already on the list'); save(key, [...list, t]); toast('Added'); setTerm(''); };
    const chip = (t: string) => <span key={t} className="vchip">{t}{!!count(t) && <span className="muted">{count(t)}</span>}<button aria-label={'Remove ' + t} onClick={() => { save(key, list.filter((x) => x !== t)); toast('Removed: items using it now show as off-list'); }}>×</button></span>;
    const groups: Record<string, string[]> = {};
    [...list].sort((a, b) => a.localeCompare(b, 'fr')).forEach((t) => (groups[t.normalize('NFD')[0].toUpperCase()] ||= []).push(t));
    const off = field ? [...new Set(data.products.map((p) => String(p[field] || '')).filter((v) => v && v !== 'UNKNOWN' && !list.includes(v)))] : [];
    body = (
      <>
        <div className="row" style={{ marginBottom: 10 }}><input type="text" value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add(term)} placeholder="Add a term" style={{ width: 280 }} /><button className="btn dark sm" onClick={() => add(term)}>Add</button></div>
        {def.ordered ? <div>{list.map(chip)}</div> : Object.entries(groups).map(([L, ts]) => <div key={L}><div className="letter">{L}</div><div>{ts.map(chip)}</div></div>)}
        {!!off.length && key !== 'archiveBrands' && <>
          <h3 style={{ marginTop: 24 }}>Off-list values in use</h3>
          <p className="small muted" style={{ marginTop: -6 }}>Values typed or imported that are not in this vocabulary yet. Add them, or correct the items.</p>
          {off.map((v) => <span key={v} className="vchip offv">{v} <span className="muted">{count(v)}</span><button onClick={() => add(v)}>+ add</button></span>)}
        </>}
      </>
    );
  }
  return (
    <>
      <div className="eyebrow">Controlled vocabulary</div><h1>Vocabulary</h1>
      <p className="lede">Every dropdown in Ingestion reads from these lists, and imports are matched against them. Add a term here and it appears everywhere; a value that is not on a list shows in orange until it is added or corrected.</p>
      <div className="brands">
        <div className="card blist" style={{ padding: 10 }}>{VOCAB_LISTS.map((x) => <a key={x.key} className={x.key === key ? 'on' : ''} onClick={() => setKey(x.key)}><span>{x.label}</span><span className="n">{x.key === 'sizes' ? Object.keys(data.vocab.sizes).length : (data.vocab[x.key] as string[]).length}</span></a>)}</div>
        <div className="card"><h2>{def.label}</h2>{def.help && <p className="small muted" style={{ marginTop: -4 }}>{def.help}</p>}{body}</div>
      </div>
    </>
  );
}
