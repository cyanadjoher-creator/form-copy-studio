'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, useData } from '@/components/data';
import { pct } from '@/components/ui';
import { normCode, normSeason, parseCSV, refKey, refLinked, refMatch, titleCase, type Product, type Ref } from '@/lib/domain';

const REF_FIELDS: [keyof Ref, string[]][] = [['boutiqueRef', ['boutique id', 'listing id', 'shopify id', 'product id']], ['code', ['product code', 'code', 'style code', 'style', 'model', 'reference', 'ref', 'article']], ['brand', ['brand', 'designer', 'maison', 'house', 'vendor']], ['season', ['season', 'collection', 'year', 'saison']], ['name', ['name', 'item', 'title', 'description', 'product']], ['category', ['category', 'type']], ['note', ['note', 'notes', 'comment']]];

export default function Codes() {
  const { data, patch, toast } = useData();
  const router = useRouter();
  const [q, setQ] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  if (!data) return null;
  const linked = (r: Ref) => refLinked(data.products, r);
  const list = data.refs.filter((r) => !q || [r.code, r.boutiqueRef, r.brand, r.season, r.name].join(' ').toLowerCase().includes(q.toLowerCase()) || (!!r.code && normCode(r.code).includes(normCode(q))) || (!!r.boutiqueRef && normCode(r.boutiqueRef).includes(normCode(q))));
  const orphan = data.products.filter((p) => p.productCode && !refMatch(data.refs, p.productCode));
  const coded = data.products.filter((p) => p.productCode).length;

  async function add(refs: Partial<Ref>[]) {
    const r = await api<{ added: number; refs: Ref[] }>('/api/refs', { body: { refs } });
    patch((d) => ({ ...d, refs: r.refs }));
    return r.added;
  }
  const fromProduct = (p: Product): Ref => ({ code: p.productCode.trim(), boutiqueRef: p.boutiqueRef || '', brand: p.brand, season: p.season, name: p.name, category: p.category, source: 'Added from ' + (p.sku || p.id), note: '' });
  async function importFile(f: File) {
    let rows: string[][];
    try {
      if (/\.xlsx?$/i.test(f.name)) { const XLSX = await import('xlsx'); const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false }) as string[][]; }
      else rows = parseCSV(await f.text());
    } catch { return toast('Could not read this file'); }
    if (rows.length < 2) return toast('No rows found');
    const head = rows[0].map((x) => String(x).toLowerCase().trim());
    const idx: Partial<Record<keyof Ref, number>> = {};
    REF_FIELDS.forEach(([k, syn]) => { let i = head.findIndex((h) => syn.includes(h)); if (i < 0) i = head.findIndex((h) => syn.some((s) => h.includes(s))); if (i >= 0 && !Object.values(idx).includes(i)) idx[k] = i; });
    if (idx.code == null && idx.boutiqueRef == null) return toast('No code column found');
    const g = (r: string[], k: keyof Ref) => (idx[k] != null ? String(r[idx[k]!] || '').trim() : '');
    const refs = rows.slice(1).map((r) => ({ code: g(r, 'code'), boutiqueRef: g(r, 'boutiqueRef'), brand: g(r, 'brand').toUpperCase(), season: g(r, 'season') ? normSeason(g(r, 'season')).season : '', name: g(r, 'name'), category: g(r, 'category'), source: f.name, note: g(r, 'note') })).filter((r) => r.code || r.boutiqueRef);
    toast(`${await add(refs)} codes imported`);
  }

  return (
    <>
      <div className="eyebrow">Identification · reference base</div><h1>Product code</h1>
      <p className="lede">Every product code we know, with its brand, season and item. Type a code from a label to identify the piece. Codes recorded in Ingestion are checked against this list, and new ones are added once confirmed.</p>
      <div className="grid g5 kpis" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
        <div className="card kpi"><div className="l">Codes in the base</div><div className="v">{data.refs.length}</div><div className="s">{new Set(data.refs.map((r) => r.brand)).size} brands</div></div>
        <div className="card kpi"><div className="l">Stock with a code</div><div className="v">{pct(coded, data.products.length)}<small>%</small></div><div className="s">{coded} of {data.products.length} items</div></div>
        <div className="card kpi"><div className="l">Matched</div><div className="v">{data.products.filter((p) => refMatch(data.refs, p.productCode)).length}</div><div className="s">items identified by their code</div></div>
        <div className="card kpi alert"><div className="l">Not in the base</div><div className="v">{orphan.length}</div><div className="s">codes in stock to verify and add</div></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', marginTop: 14, alignItems: 'start' }}>
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3>Look up a code</h3>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type or paste the code from a label" style={{ font: '16px var(--mono)', padding: 12 }} />
            <div className="help">Spaces, dots, slashes and hyphens are ignored when matching.</div>
          </div>
          <div className="tbl-wrap"><table><thead><tr><th>Product code</th><th>Boutique ID</th><th>Brand</th><th>Season</th><th>Item</th><th>Category</th><th className="num">In stock</th><th>Source</th><th /></tr></thead><tbody>
            {list.map((r) => { const l = linked(r); return (
              <tr key={refKey(r)} className={l.length ? 'click' : ''} onClick={() => l.length && router.push('/ingestion/' + l[0].id)}>
                <td className="id">{r.code || <span className="ftag miss">garment code missing</span>}</td><td className="mono small">{r.boutiqueRef || '-'}</td><td>{titleCase(r.brand)}</td><td>{r.season || '-'}</td><td className="t">{r.name || '-'}</td><td className="small">{r.category || '-'}</td><td className="num">{l.length || '-'}</td><td className="small muted">{r.source}</td>
                <td><button className="btn sm ghost" onClick={async (e) => { e.stopPropagation(); patch((d) => ({ ...d, refs: d.refs.filter((x) => refKey(x) !== refKey(r)) })); await api('/api/refs?code=' + encodeURIComponent(refKey(r)), { method: 'DELETE' }); }}>Remove</button></td>
              </tr>); })}
            {!list.length && <tr><td colSpan={9} className="muted" style={{ padding: 30, textAlign: 'center' }}>No code matches. Add it from the item in Ingestion once checked against the label.</td></tr>}
          </tbody></table></div>
        </div>
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3>Import reference codes</h3>
            <div className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) importFile(f); }}>
              <button className="btn dark" onClick={() => fileRef.current?.click()}>Import list</button><span className="muted small">.csv or .xlsx</span></div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.tsv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
            <div className="help">Columns matched by name: code (on the garment), boutique ID, brand, season, item name, category, note. Codes already in the base are skipped.</div>
          </div>
          <div className="card">
            <div className="row between"><h3 style={{ margin: 0 }}>Codes in stock, not in the base</h3>{!!orphan.length && <button className="btn sm" onClick={async () => toast(`${await add(orphan.map(fromProduct))} codes added`)}>Add all</button>}</div>
            <p className="small muted" style={{ margin: '6px 0 8px' }}>Check each against its label photo before adding.</p>
            {orphan.slice(0, 40).map((p) => (
              <div key={p.id} className="row between small" style={{ padding: '7px 0', borderBottom: '1px solid var(--rule-2)', flexWrap: 'nowrap' }}>
                <span><span className="mono">{p.productCode}</span><br /><span className="muted">{titleCase(p.brand)} · {p.name}</span></span>
                <span className="row" style={{ flexWrap: 'nowrap', flex: 'none' }}><button className="btn sm ghost" onClick={() => router.push('/ingestion/' + p.id)}>Open</button><button className="btn sm" onClick={async () => { await add([fromProduct(p)]); toast('Added'); }}>Add</button></span>
              </div>
            ))}
            {!orphan.length && <p className="small muted">Every recorded code is in the base.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
