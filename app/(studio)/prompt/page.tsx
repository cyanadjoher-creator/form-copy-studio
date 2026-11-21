'use client';
import { useEffect, useState } from 'react';
import { api, useData } from '@/components/data';
import { titleCase, type Prompt } from '@/lib/domain';

export default function PromptPage() {
  const { data, patch, toast } = useData();
  const active = data?.prompts.find((x) => x.active) || data?.prompts[data.prompts.length - 1];
  const [sel, setSel] = useState<number | undefined>(active?.v);
  const cur = data?.prompts.find((x) => x.v === sel) || active;
  const [text, setText] = useState(cur?.text || '');
  const [rules, setRules] = useState(cur?.rules || '');
  const [note, setNote] = useState('');
  const [testId, setTestId] = useState('');
  const [out, setOut] = useState<{ websiteCopy: string; boutiqueText: string; flags: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(cur?.text || ''); setRules(cur?.rules || ''); }, [cur?.v]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data || !cur) return null;
  const usage = (v: number) => data.products.filter((p) => p.promptV === v).length;
  const testP = data.products.find((p) => p.id === testId) || data.products.find((p) => p.photos.length) || data.products[0];
  const nextV = Math.max(0, ...data.prompts.map((x) => x.v)) + 1;
  const setPrompts = (prompts: Prompt[]) => patch((d) => ({ ...d, prompts }));

  return (
    <>
      <div className="eyebrow">Copy prompt · versioned</div><h1>Copy prompt</h1>
      <p className="lede">The prompt every draft is written with. Edit it, save a new version and it becomes active straight away. Each draft records which version wrote it. The photo-reading instructions and the output format are added by the code under this prompt, so editing the tone can never break them.</p>
      <div className="grid" style={{ gridTemplateColumns: '240px minmax(0,1fr) minmax(0,1fr)', alignItems: 'start' }}>
        <div className="card" style={{ padding: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Versions</div>
          {[...data.prompts].reverse().map((x) => (
            <div key={x.v} className={'ver' + (x.v === cur.v ? ' on' : '')} onClick={() => setSel(x.v)}>
              <b>v{x.v}</b> {x.active && <span className="pill s-Approved" style={{ fontSize: 10, padding: '2px 6px' }}>active</span>}
              <small>{x.created} · {usage(x.v)} drafts</small><div className="small muted">{x.note}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="row between"><h3 style={{ margin: 0 }}>Prompt v{cur.v}</h3><span className="muted small">Variables: <code>{'{{BRAND}}'}</code> <code>{'{{name}}'}</code> <code>{'{{season}}'}</code> <code>{'{{madeIn}}'}</code></span></div>
          <textarea rows={22} style={{ marginTop: 10, font: '12.5px/1.6 var(--mono)' }} value={text} onChange={(e) => setText(e.target.value)} />
          <label className="f">House rules <span>added to every call</span></label>
          <textarea rows={8} style={{ font: '12.5px/1.6 var(--mono)' }} value={rules} onChange={(e) => setRules(e.target.value)} />
          <label className="f">Version note</label><input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed and why" />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn dark" onClick={async () => { try { const r = await api<{ v: number; prompts: Prompt[] }>('/api/prompts', { body: { text, rules, note } }); setPrompts(r.prompts); setSel(r.v); setNote(''); toast(`v${r.v} saved and active`); } catch (e) { toast((e as Error).message); } }}>Save as v{nextV}</button>
            {!cur.active && <button className="btn" onClick={async () => { setPrompts(await api<Prompt[]>('/api/prompts/' + cur.v, { method: 'PATCH' })); toast(`v${cur.v} active`); }}>Set v{cur.v} active</button>}
          </div>
        </div>
        <div className="card">
          <h3>Ontology context</h3>
          <p className="small muted" style={{ marginTop: -4 }}>Not connected yet. Each draft will receive the matching records from the ontology (Payload) before the prompt, so the context paragraph is written from verified data.</p>
          <ul className="checks" style={{ margin: '0 0 6px' }}>
            <li className="no">Brand · house name, founding, designers by period</li>
            <li className="no">Designer · who led the house that season</li>
            <li className="no">Collection Master · title, show date, venue, inspiration</li>
            <li className="no">Look Master · look number, model, runway image</li>
            <li className="no">Thematic tags and movements</li>
          </ul>
          <h3 style={{ marginTop: 20 }}>Test bench</h3>
          <p className="muted small" style={{ marginTop: -4 }}>Runs the prompt in the editor (saved or not) on one product, with its photos, without changing it.</p>
          <select value={testP?.id} onChange={(e) => { setTestId(e.target.value); setOut(null); }}>{data.products.map((p) => <option key={p.id} value={p.id}>{titleCase(p.brand)} · {p.name || 'Untitled'}</option>)}</select>
          <button className="btn" style={{ marginTop: 10 }} disabled={busy} onClick={async () => { setBusy(true); try { setOut(await api('/api/ai/test', { body: { id: testP.id, text, rules } })); } catch (e) { toast((e as Error).message); } setBusy(false); }}>{busy ? 'Running…' : 'Run test'}</button>
          <div className="grid g2" style={{ marginTop: 12, gap: 10 }}>
            <div><div className="eyebrow">Current copy</div><pre className="code" style={{ marginTop: 6, maxHeight: 420, overflow: 'auto' }}>{testP?.copy || '(none)'}</pre></div>
            <div><div className="eyebrow">Test output</div><pre className="code" style={{ marginTop: 6, maxHeight: 420, overflow: 'auto' }}>{out ? [out.websiteCopy, out.boutiqueText && '---\n' + out.boutiqueText, out.flags?.length && '---\n' + out.flags.join('\n')].filter(Boolean).join('\n\n') : 'Run a test to compare.'}</pre></div>
          </div>
        </div>
      </div>
    </>
  );
}
