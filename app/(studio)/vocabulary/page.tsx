'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, useData } from '@/components/data';
import { VOCAB_LISTS, type Product, type Vocab } from '@/lib/domain';
import { FROZEN_FIELD_LISTS, GLOSSARY, COPY_ORDER, SOURCE_LABEL, SECTION_ORDER, SHORT_DESCRIPTION_RULE, frozenTerm, type GlossSource } from '@/lib/glossary';

const FROZEN_KEYS = ['colours', 'conditions', 'seasonTypes', 'brands'] as const;
type FrozenKey = (typeof FROZEN_KEYS)[number];
const isFrozenKey = (k: string): k is FrozenKey => (FROZEN_KEYS as readonly string[]).includes(k);

export default function Page() { return <Suspense><VocabularyView /></Suspense>; }

function VocabularyView() {
  const { data, patch, toast } = useData();
  const [key, setKey] = useState<keyof Vocab | 'glossary'>((useSearchParams().get('v') as keyof Vocab | 'glossary') || 'glossary');
  const [gkey, setGkey] = useState('all');
  const [gq, setGq] = useState('');
  const [busyFix, setBusyFix] = useState('');
  const [term, setTerm] = useState('');
  const [newSys, setNewSys] = useState('');
  if (!data) return null;
  const def = VOCAB_LISTS.find((x) => x.key === key) || VOCAB_LISTS[0];
  async function applyTerm(field: keyof Product, from: string, to: string) {
    const items = data!.products.filter((p) => p[field] === from);
    setBusyFix(from);
    try {
      for (const it of items) {
        const np = await api<Product>('/api/products/' + it.id, { method: 'PATCH', body: { patch: { [field]: to }, revision: it.revision } });
        patch((d) => ({ ...d, products: d.products.map((x) => (x.id === np.id ? np : x)) }));
      }
      toast(`${items.length} item${items.length > 1 ? 's' : ''} now use "${to}"`);
    } catch (e) { toast((e as Error).message); }
    setBusyFix('');
  }
  async function save(k: keyof Vocab, value: unknown) {
    try { const vocab = await api<Vocab>('/api/vocab', { method: 'PUT', body: { key: k, value } }); patch((d) => ({ ...d, vocab })); }
    catch (e) { toast((e as Error).message); }
  }
  const field = def.field as keyof Product | null;
  const count = (t: string) => (field ? data.products.filter((p) => p[field] === t).length : 0);

  let body: React.ReactNode;
  if (key === 'glossary') {
    const q = gq.trim().toLowerCase();
    const groups = GLOSSARY.filter((g) => gkey === 'all' ? g.key !== 'houses' && g.key !== 'countries' : g.key === gkey)
      .map((g) => ({ ...g, terms: q ? g.terms.filter((t) => t.t.toLowerCase().includes(q) || (t.aka || []).some((a) => a.includes(q))) : g.terms }))
      .filter((g) => g.terms.length);
    const dot = (s: GlossSource) => <span key={s} className={'src-dot src-' + s} title={SOURCE_LABEL[s]} />;
    body = (
      <>
        <p className="small" style={{ marginTop: -4 }}>The words the copy uses, by category. Generate copy is given these terms and the Copy Guide order; boutique wording (US spelling, other names) is rewritten to the FORM term when it is a safe change and suggested otherwise. Frozen terms come from the 4 November freeze and are not edited here.</p>
        <div className="gloss-legend">{(Object.keys(SOURCE_LABEL) as GlossSource[]).map((s) => <span key={s}>{dot(s)} {SOURCE_LABEL[s]}</span>)}</div>
        <div className="row" style={{ margin: '8px 0' }}><input type="text" value={gq} onChange={(e) => setGq(e.target.value)} placeholder="Find a term or a boutique word (e.g. zipper, mandarin)" style={{ width: 360 }} /></div>
        <div className="gloss-groups">
          <a className={gkey === 'all' ? 'on' : ''} onClick={() => setGkey('all')}>All categories</a>
          {GLOSSARY.map((g) => <a key={g.key} className={gkey === g.key ? 'on' : ''} onClick={() => setGkey(g.key)}>{g.label} · {g.terms.length}</a>)}
          <a className={gkey === 'order' ? 'on' : ''} onClick={() => setGkey('order')}>Copy Guide order</a>
        </div>
        {gkey === 'order' ? <div className="gloss-group tone-guide">
          <h3>Copy Guide order</h3>
          <p className="small muted">Sections: {SECTION_ORDER.join(' › ')}. {SHORT_DESCRIPTION_RULE}</p>
          <table><tbody>{Object.entries(COPY_ORDER).map(([t, o]) => <tr key={t}><td style={{ whiteSpace: 'nowrap' }}><b>{t}</b>{!o.fromGuide && <span className="small" style={{ color: '#a35400' }}> · studio default, to validate</span>}</td><td>{o.order.join(' → ')}{!!o.notes.length && <div className="small muted">{o.notes.join(' ')}</div>}</td></tr>)}</tbody></table>
        </div> : groups.map((g) => <div key={g.key} className={'gloss-group tone-' + g.tone}>
          <h3>{g.label} <span className="small muted">{g.terms.length} terms</span></h3>
          {g.help && <p className="small muted" style={{ margin: '0 0 6px' }}>{g.help}</p>}
          <div>{g.terms.map((t) => <span key={t.t} className={'gterm' + (t.src.length === 1 && t.src[0] === 'studio' ? ' studio' : '')}>{t.src.map(dot)}{t.t}{!!t.aka?.length && <span className="aka">{g.key === 'shop' ? t.aka.join(', ') : 'not ' + t.aka.join(', ')}</span>}</span>)}</div>
        </div>)}
      </>
    );
  } else if (key === 'sizes') {
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
    const lkey = key as Exclude<keyof Vocab, 'sizes'>;
    const list = data.vocab[lkey] as string[];
    const frozenSet = isFrozenKey(lkey) ? new Set((FROZEN_FIELD_LISTS[lkey] as string[]).map((x) => x.toLowerCase())) : null;
    const add = (raw: string) => { const t = key === 'brands' || key === 'archiveBrands' ? raw.trim().toUpperCase() : raw.trim(); if (!t) return; if (list.includes(t)) return toast('Already on the list'); save(lkey, [...list, t]); toast('Added'); setTerm(''); };
    const frozenOf = (t: string) => !!frozenSet && frozenSet.has(t.toLowerCase());
    const chip = (t: string) => <span key={t} className={'vchip' + (frozenSet && !frozenOf(t) ? ' offv' : '')} title={frozenOf(t) ? 'Frozen term (4 Nov)' : frozenSet ? 'Added in the studio, not in the freeze' : ''}>{frozenOf(t) && <span className="src-dot src-freeze" />}{t}{!!count(t) && <span className="muted">{count(t)}</span>}{!frozenOf(t) && <button aria-label={'Remove ' + t} onClick={() => { save(lkey, list.filter((x) => x !== t)); toast('Removed: items using it now show as off-list'); }}>×</button>}</span>;
    const groups: Record<string, string[]> = {};
    [...list].sort((a, b) => a.localeCompare(b, 'fr')).forEach((t) => (groups[t.normalize('NFD')[0].toUpperCase()] ||= []).push(t));
    const off = field ? [...new Set(data.products.map((p) => String(p[field] || '')).filter((v) => v && v !== 'UNKNOWN' && !list.includes(v)))] : [];
    body = (
      <>
        <div className="row" style={{ marginBottom: 10 }}><input type="text" value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add(term)} placeholder="Add a term" style={{ width: 280 }} /><button className="btn dark sm" onClick={() => add(term)}>Add</button></div>
        {def.ordered ? <div>{list.map(chip)}</div> : Object.entries(groups).map(([L, ts]) => <div key={L}><div className="letter">{L}</div><div>{ts.map(chip)}</div></div>)}
        {!!off.length && key !== 'archiveBrands' && <>
          <h3 style={{ marginTop: 24 }}>Off-list values in use</h3>
          <p className="small muted" style={{ marginTop: -6 }}>Values typed or imported that are not in this vocabulary. Where the freeze has the closest term, one click moves the items onto it; otherwise add the value as a studio term (shown in orange) or correct the items.</p>
          {off.map((v) => {
            const f = isFrozenKey(lkey) ? frozenTerm(lkey, v) : null;
            const targets = f ? f.choices.map((c) => list.find((x) => x.toLowerCase() === c.toLowerCase()) || (lkey === 'brands' ? c.toUpperCase() : c)) : [];
            return <div key={v} className="row" style={{ margin: '4px 0', gap: 6, flexWrap: 'wrap' }}>
              <span className="vchip offv" style={{ margin: 0 }}>{v} <span className="muted">{count(v)}</span></span>
              {targets.length ? <>
                <span className="small muted">{targets.length > 1 ? 'closest frozen terms:' : 'frozen term:'}</span>
                {targets.map((t) => <button key={t} className="btn sm" disabled={!!busyFix} onClick={() => field && applyTerm(field, v, t)}>{busyFix === v ? 'Updating…' : `Use "${t}" on ${count(v)}`}</button>)}
              </> : <button className="btn sm ghost" onClick={() => add(v)}>{frozenSet ? '+ add as a studio term' : '+ add'}</button>}
            </div>;
          })}
        </>}
      </>
    );
  }
  return (
    <>
      <div className="eyebrow">Controlled vocabulary</div><h1>Vocabulary</h1>
      <p className="lede">One vocabulary for the copy: the FORM frozen vocabulary (4 November) first, the Copy Guide for order and part names, then Fashionpedia and Sewing for Fashion Designers for the closest standard names. Dropdowns and imports read the lists below; boutique wording is adapted to them.</p>
      <div className="brands">
        <div className="card blist" style={{ padding: 10 }}><a className={key === 'glossary' ? 'on' : ''} onClick={() => setKey('glossary')}><span><b>FORM glossary</b></span><span className="n">{GLOSSARY.reduce((n, g) => n + g.terms.length, 0)}</span></a>{VOCAB_LISTS.map((x) => <a key={x.key} className={x.key === key ? 'on' : ''} onClick={() => setKey(x.key)}><span>{x.label}</span><span className="n">{x.key === 'sizes' ? Object.keys(data.vocab.sizes).length : (data.vocab[x.key] as string[]).length}</span></a>)}</div>
        <div className="card"><h2>{key === 'glossary' ? 'FORM glossary' : def.label}</h2>{key !== 'glossary' && def.help && <p className="small muted" style={{ marginTop: -4 }}>{def.help}</p>}{body}</div>
      </div>
    </>
  );
}
