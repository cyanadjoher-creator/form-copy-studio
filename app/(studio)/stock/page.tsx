'use client';
import { Suspense, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, useData } from '@/components/data';
import { cover, FieldsBadge, sizeLabel, StagePill, useLightbox } from '@/components/ui';
import { FIELDS, ROLE_CARE, ROLE_LABEL, STAGES, guessField, hasRole, parseCSV, readiness, refMatch, shopifyGroup, titleCase, type Product } from '@/lib/domain';

const FLAG_FILTERS: Record<string, (p: Product) => boolean> = {
  'Missing fields': (p) => readiness(p).missing.length > 0,
  Conflicts: (p) => readiness(p).conflicts.length > 0,
  'To check': (p) => readiness(p).tocheck.length > 0,
  'Needs info': (p) => p.needsInfo,
  'No product code': (p) => !p.productCode,
  'No label photo': (p) => !hasRole(p, ROLE_LABEL),
  'No care label': (p) => !hasRole(p, ROLE_CARE),
};

export default function StockPage() { return <Suspense><Stock /></Suspense>; }

function Stock() {
  const { data, reload, toast } = useData();
  const router = useRouter();
  const sp = useSearchParams();
  const lb = useLightbox();
  const [boutique, setBoutique] = useState(sp.get('b') || 'all');
  const [q, setQ] = useState('');
  const [fBrand, setFBrand] = useState('');
  const [fSeason, setFSeason] = useState(sp.get('season') || '');
  const [fStatus, setFStatus] = useState(sp.get('f') || '');
  const [mapping, setMapping] = useState<{ rows: string[][]; name: string } | null>(null);
  const [paste, setPaste] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    if (!data) return [];
    const ql = q.toLowerCase();
    return data.products.filter((p) => (boutique === 'all' || p.boutiqueId === boutique) && (!fBrand || p.brand === fBrand) && (!fSeason || p.season === fSeason)
      && (!fStatus || (FLAG_FILTERS[fStatus] ? FLAG_FILTERS[fStatus](p) : p.status === fStatus))
      && (!ql || [p.sku, p.boutiqueRef, p.productCode, p.brand, p.name, p.season, p.material, p.boutiqueDesc].join(' ').toLowerCase().includes(ql)));
  }, [data, boutique, fBrand, fSeason, fStatus, q]);
  if (!data) return null;
  const brands = [...new Set(data.products.map((p) => p.brand))].sort();
  const seasons = [...new Set(data.products.map((p) => p.season))].sort();

  async function readFile(f: File) {
    let rows: string[][];
    try {
      if (/\.xlsx?$/i.test(f.name)) {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
        rows = (XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false }) as string[][]).filter((r) => r.some((x) => String(x).trim()));
      } else rows = parseCSV(await f.text());
    } catch { return toast('Could not read this file'); }
    if (rows.length < 2) return toast('No rows found');
    openMapping(rows, f.name);
  }
  function openMapping(rows: string[][], name: string) {
    const g = shopifyGroup(rows);
    if (g.merged) toast(`Shopify export: ${rows.length - 1} rows merged into ${g.rows.length - 1} products`);
    setMapping({ rows: g.rows, name });
  }
  function copyCsv() {
    const cols: (keyof Product)[] = ['sku', 'boutiqueRef', 'productCode', 'brand', 'name', 'season', 'seasonRaw', 'size', 'condition', 'colour', 'material', 'madeIn', 'measurements', 'care', 'status'];
    const csv = [cols.join(','), ...list.map((p) => cols.map((c) => `"${String(p[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    navigator.clipboard.writeText(csv).then(() => toast(`${list.length} rows copied`), () => toast('Copy blocked by the browser'));
  }

  return (
    <>
      <div className="eyebrow">Ingestion · boutique stock lists</div>
      <h1>Boutique stock</h1>
      <p className="lede">Import the stock: a Shopify product export (CSV) or the boutique&apos;s own file (CSV or Excel). Columns are matched to FORM fields, the boutique description is read into empty fields, and every item shows what is missing or conflicting. Nothing syncs automatically: products are still edited in Shopify.</p>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}>
          <a className="btn ghost" href="/templates/FORM_Copy_Studio_Stock_Template.xlsx" download>Download the Excel template</a>
          <button className="btn dark" onClick={() => fileRef.current?.click()}>Import stock list</button>
          <span className="muted">or drop a Shopify export or a boutique .csv / .xlsx here</span>
          <span style={{ flex: 1 }} />
          <button className="btn ghost sm" onClick={() => setPaste(true)}>Paste rows from a spreadsheet</button>
        </div>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.tsv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }} />
      </div>
      <div className="chips">
        {[['all', 'All boutiques', data.products.length] as const, ...data.boutiques.map((b) => [b.id, b.name, data.products.filter((p) => p.boutiqueId === b.id).length] as const)].map(([id, n, c]) => (
          <button key={id} className={'chip' + (boutique === id ? ' on' : '')} onClick={() => setBoutique(id)}>{n}<span className="n">{c}</span></button>
        ))}
      </div>
      <div className="filters">
        <input type="search" placeholder="Search SKU, product code, name, material" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={fBrand} onChange={(e) => setFBrand(e.target.value)}><option value="">All brands</option>{brands.map((b) => <option key={b} value={b}>{titleCase(b)}</option>)}</select>
        <select value={fSeason} onChange={(e) => setFSeason(e.target.value)}><option value="">All seasons</option>{seasons.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">All stages</option>{[...STAGES, ...Object.keys(FLAG_FILTERS)].map((s) => <option key={s}>{s}</option>)}</select>
        <button className="btn ghost" onClick={() => { setQ(''); setFBrand(''); setFSeason(''); setFStatus(''); }}>Clear</button>
      </div>
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="muted small"><b style={{ color: 'var(--ink)' }}>{list.length}</b> items</span>
        <button className="btn sm ghost" onClick={copyCsv}>Copy as CSV</button>
      </div>
      <div className="tbl-wrap"><table><thead><tr><th /><th>Boutique SKU</th><th>Product code</th><th>Brand</th><th>Item</th><th>Season</th><th>As supplied</th><th>Size</th><th>Colour</th><th>Made in</th><th>Photos</th><th>Label · care</th><th>Fields</th><th>Stage</th><th>Boutique</th></tr></thead><tbody>
        {list.map((p) => (
          <tr key={p.id} className="click" onClick={() => router.push('/ingestion/' + p.id)}>
            <td>{cover(p) ? <img className="tthumb" src={cover(p)} alt="" onClick={(e) => { e.stopPropagation(); lb.open(p, 0); }} /> : <span className="tthumb" />}</td>
            <td className="id">{p.sku}</td>
            <td className="id">{p.productCode ? <>{p.productCode}{refMatch(data.refs, p.productCode) && <> <span className="pill s-Approved" title="In the reference base">ref</span></>}</> : <span className="pill p-bad">missing</span>}</td>
            <td>{titleCase(p.brand)}</td><td className="t">{p.name}</td>
            <td>{p.season === 'Unknown' ? <span className="pill p-mute">Unknown</span> : p.season}</td>
            <td className="id muted">{p.seasonRaw || '-'}</td><td>{sizeLabel(p)}</td><td>{p.colour || '-'}</td>
            <td>{p.madeIn || '-'}</td><td className="num">{p.photos.length || '-'}</td>
            <td className="small">{hasRole(p, ROLE_LABEL) ? '✓' : <span style={{ color: 'var(--bad)' }}>-</span>} · {hasRole(p, ROLE_CARE) ? '✓' : <span style={{ color: 'var(--bad)' }}>-</span>}</td>
            <td><FieldsBadge p={p} /></td>
            <td><StagePill s={p.status} />{p.needsInfo && <> <span className="pill p-bad">info</span></>}</td>
            <td className="small muted">{data.boutiques.find((b) => b.id === p.boutiqueId)?.name}</td>
          </tr>
        ))}
        {!list.length && <tr><td colSpan={15} className="muted" style={{ padding: 30, textAlign: 'center' }}>No items match.</td></tr>}
      </tbody></table></div>
      {paste && <PasteModal onClose={() => setPaste(false)} onRows={(rows) => { setPaste(false); openMapping(rows, 'pasted rows'); }} />}
      {mapping && <MapModal rows={mapping.rows} name={mapping.name} onClose={() => setMapping(null)} onDone={async (r) => { setMapping(null); await reload(); setBoutique(r.boutiqueId); toast(`${r.imported} items imported`); }} />}
      {lb.node}
    </>
  );
}

function PasteModal({ onClose, onRows }: { onClose: () => void; onRows: (rows: string[][]) => void }) {
  const [t, setT] = useState('');
  const { toast } = useData();
  return (
    <div className="modal-bg show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="modal">
      <h2>Paste rows</h2><p className="muted small">Copy a block from Excel or Google Sheets, header row included, and paste it here.</p>
      <textarea rows={12} value={t} onChange={(e) => setT(e.target.value)} />
      <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}><button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn dark" onClick={() => { const rows = parseCSV(t); if (rows.length < 2) return toast('Need a header row and at least one item'); onRows(rows); }}>Continue</button></div>
    </div></div>
  );
}

function MapModal({ rows, name, onClose, onDone }: { rows: string[][]; name: string; onClose: () => void; onDone: (r: { imported: number; boutiqueId: string }) => void }) {
  const { data, toast } = useData();
  const head = rows[0].map(String), body = rows.slice(1);
  const [map, setMap] = useState<string[]>(() => { const used = new Set<string>(); return head.map((h) => { const g = guessField(h); if (!g || used.has(g)) return ''; used.add(g); return g; }); });
  const [bid, setBid] = useState(data?.boutiques.find((b) => b.id !== 'B0')?.id || 'new');
  const [bname, setBname] = useState('');
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!map.includes('brand') && !map.includes('name')) return toast('Map at least Brand or Item name');
    const items = body.map((r) => {
      const o: Record<string, string> = {}; const extra: string[] = [];
      head.forEach((h, i) => { const v = String(r[i] ?? '').trim(); if (!v) return; if (/^FORM (title|description) draft$/i.test(h.trim()) && !map[i]) return; if (map[i]) o[map[i]] = o[map[i]] ? o[map[i]] + ' ' + v : v; else extra.push(`${h}: ${v}`); });
      if (extra.length) o.notes = [o.notes, ...extra].filter(Boolean).join('\n');
      return o;
    });
    setBusy(true);
    try { onDone(await api<{ imported: number; boutiqueId: string }>('/api/import', { body: { boutiqueId: bid, boutiqueName: bname, items } })); }
    catch (e) { toast(e instanceof Error ? e.message : 'Import failed'); setBusy(false); }
  }
  return (
    <div className="modal-bg show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className={'modal' + (busy ? ' busy' : '')}>
      <div className="eyebrow">{name} · {body.length} rows</div><h2>Map columns to FORM fields</h2>
      <p className="muted small">Detected from the header names. The Boutique column, if mapped, sets the boutique for each row. The dropdown is the fallback for rows without a boutique. Prior FORM drafts are not treated as source evidence.</p>
      <div className="row" style={{ margin: '12px 0 16px' }}>
        <label className="f" style={{ margin: 0 }}>Boutique</label>
        <select style={{ width: 'auto' }} value={bid} onChange={(e) => setBid(e.target.value)}>{data?.boutiques.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}<option value="new">+ New boutique</option></select>
        {bid === 'new' && <input type="text" placeholder="New boutique name" style={{ width: 260 }} value={bname} onChange={(e) => setBname(e.target.value)} />}
      </div>
      <div className="map"><span className="h">Their column</span><span className="h">FORM field</span><span className="h">First values</span>
        {head.map((h, i) => [
          <b key={'h' + i}>{h || '(empty)'}</b>,
          <select key={'s' + i} value={map[i]} onChange={(e) => setMap(map.map((m, j) => (j === i ? e.target.value : m)))}><option value="">Keep in notes</option>{FIELDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>,
          <span key={'v' + i} className="muted small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{body.slice(0, 3).map((r) => r[i]).filter(Boolean).join(' · ')}</span>,
        ])}
      </div>
      <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn dark" onClick={go}>Import {body.length} items</button></div>
    </div></div>
  );
}
