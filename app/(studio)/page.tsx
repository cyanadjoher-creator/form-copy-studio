'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useData } from '@/components/data';
import { cover, pct, StagePill, useLightbox } from '@/components/ui';
import { DONE, PROG, STAGES, decade, group, readiness, titleCase, type Product } from '@/lib/domain';

const STAGE_COL: Record<string, string> = { Imported: '#EFEFEC', Photographed: '#E9E6F5', Drafted: '#FAEBCB', 'In review': '#F7E0CE', Approved: '#E5F0E6', 'In Shopify': '#111111' };

export default function Overview() {
  const { data } = useData();
  const router = useRouter();
  const lb = useLightbox();
  if (!data) return null;
  const ps = data.products, n = ps.length;
  const by = (k: (p: Product) => string) => { const m: Record<string, Product[]> = {}; ps.forEach((p) => (m[k(p)] ||= []).push(p)); return m; };
  const brandsM = by((p) => p.brand || 'UNKNOWN');
  const brandRows = Object.entries(brandsM).sort((a, b) => b[1].length - a[1].length);
  const maxB = brandRows[0]?.[1].length || 1;
  const done = ps.filter((p) => DONE.includes(p.status)).length;
  const stageC = STAGES.map((s) => [s, ps.filter((p) => p.status === s).length] as const);
  const seasons = Object.entries(by((p) => p.season)).filter(([s]) => s !== 'Unknown').sort((a, b) => b[1].length - a[1].length).slice(0, 10);
  const maxS = seasons[0]?.[1].length || 1;
  const decs = [...new Set(ps.map((p) => decade(p.year)))].sort();
  const decC = decs.map((d) => [d, ps.filter((p) => decade(p.year) === d).length] as const);
  const maxD = Math.max(1, ...decC.map((x) => x[1]));
  let heatMax = 1;
  const heat = brandRows.map(([b, arr]) => [b, decs.map((d) => { const c = arr.filter((p) => decade(p.year) === d).length; heatMax = Math.max(heatMax, c); return c; })] as const);
  const ab = data.vocab.archiveBrands || [];
  const sb = brandRows.map((x) => x[0]);
  const both = sb.filter((b) => ab.includes(b)), lack = sb.filter((b) => !ab.includes(b)), empty = ab.filter((b) => !sb.includes(b));
  const withImg = ps.filter((p) => p.photos.length);
  const prio = brandRows.map(([b, arr]) => {
    const rem = arr.filter((p) => !DONE.includes(p.status));
    const sm: Record<string, number> = {}; rem.forEach((p) => { if (p.season !== 'Unknown') sm[p.season] = (sm[p.season] || 0) + 1; });
    const top = Object.entries(sm).sort((a, b) => b[1] - a[1])[0];
    return { b, total: arr.length, rem: rem.length, gaps: arr.filter((p) => readiness(p).missing.length).length, top: top ? `${top[0]} (${top[1]})` : '-' };
  }).filter((x) => x.rem).sort((a, b) => b.rem - a.rem).slice(0, 6);
  const fieldsGap = ps.filter((p) => { const r = readiness(p); return r.missing.length || r.conflicts.length; }).length;
  const brandLink = (b: string) => `/brands?b=${encodeURIComponent(b)}`;
  const row = (b: string, c: number) => <Link key={b} href={brandLink(b)} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--rule-2)', textDecoration: 'none' }}><span>{titleCase(b)}</span><span className="muted">{c} item{c > 1 ? 's' : ''}</span></Link>;

  return (
    <>
      <div className="eyebrow">FORM · garment copy</div>
      <h1>Overview</h1>
      <p className="lede">What the boutique stock holds, what it matches in the archive, which brands we are missing, and where the copy stands.</p>

      <div className="grid g5 kpis">
        <div className="card kpi"><div className="l">Products</div><div className="v">{n}</div><div className="s">across {data.boutiques.length} boutiques</div></div>
        <div className="card kpi"><div className="l">Brands</div><div className="v">{brandRows.length}</div><div className="s">{both.length} already in the archive</div></div>
        <div className="card kpi"><div className="l">Copy approved</div><div className="v">{pct(done, n)}<small>%</small></div><div className="s">{done} of {n} approved or in Shopify</div></div>
        <div className="card kpi"><div className="l">In progress</div><div className="v">{ps.filter((p) => PROG.includes(p.status)).length}</div><div className="s">drafted or in review</div></div>
        <div className="card kpi alert"><div className="l">Fields to fix</div><div className="v">{fieldsGap}</div><div className="s"><Link href="/stock?f=Missing%20fields">missing or conflicting →</Link></div></div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row between"><h3 style={{ margin: 0 }}>Stock against the archive</h3><Link href="/vocabulary?v=archiveBrands" className="small muted">edit the archive brand list →</Link></div>
        <div className="grid g3" style={{ gap: 28, marginTop: 4 }}>
          <div><div className="row between"><span className="eyebrow">In stock and in the archive</span><b>{both.length}</b></div>{both.map((b) => row(b, brandsM[b].length))}{!both.length && <p className="small muted">None yet.</p>}</div>
          <div><div className="row between"><span className="eyebrow" style={{ color: 'var(--bad-ink)' }}>In stock, missing from the archive</span><b style={{ color: 'var(--bad)' }}>{lack.length}</b></div>{lack.map((b) => row(b, brandsM[b].length))}{!lack.length && <p className="small muted">None.</p>}</div>
          <div><div className="row between"><span className="eyebrow">In the archive, no stock yet</span><b>{empty.length}</b></div>{empty.map((b) => <div key={b} className="small" style={{ padding: '6px 0', borderBottom: '1px solid var(--rule-2)' }}>{titleCase(b)}</div>)}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row between"><h3 style={{ margin: 0 }}>With images · {withImg.length} products you can already see</h3><span className="muted small">click a product to open it · click a photo to see all of them</span></div>
        <div className="gal">
          {withImg.map((p) => (
            <div key={p.id} className="gcard" onClick={() => router.push('/ingestion/' + p.id)}>
              <div className="gimg"><img src={cover(p)} alt={p.name} onClick={(e) => { e.stopPropagation(); lb.open(p, 0); }} />{p.photos.length > 1 && <span className="nimg">{p.photos.length} photos</span>}</div>
              <div className="small muted" style={{ marginTop: 8 }}>{titleCase(p.brand)}</div>
              <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{p.name}</div>
              <div className="small muted">{p.season}</div>
              <div style={{ marginTop: 6 }}><StagePill s={p.status} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row between"><h3 style={{ margin: 0 }}>Stage of completion</h3><span className="muted small">click a stage to filter the stock</span></div>
        <div className="pipe">
          {stageC.filter((x) => x[1]).map(([s, c]) => (
            <div key={s} title={`${s}: ${c}`} style={{ flex: c, background: STAGE_COL[s], color: s === 'In Shopify' ? '#fff' : '#34332F', cursor: 'pointer' }} onClick={() => router.push('/stock?f=' + encodeURIComponent(s))}>{c}</div>
          ))}
        </div>
        <div className="legend">{stageC.map(([s, c]) => <span key={s} style={{ ['--c' as string]: STAGE_COL[s] }}>{s} · {c}</span>)}</div>
      </div>

      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="row between"><h3 style={{ margin: 0 }}>Products per brand</h3>
            <div className="legend"><span style={{ ['--c' as string]: 'var(--ink)' }}>done</span><span style={{ ['--c' as string]: 'var(--warn)' }}>in progress</span><span style={{ ['--c' as string]: '#D9D5CB' }}>not started</span></div></div>
          <div style={{ marginTop: 10 }}>
            {brandRows.map(([b, arr]) => {
              const d = arr.filter((p) => group(p) === 'done').length, pr = arr.filter((p) => group(p) === 'prog').length;
              return (
                <div key={b} className="hbar" onClick={() => router.push(brandLink(b))}>
                  <span className="lbl">{titleCase(b)}</span>
                  <div style={{ width: `${(arr.length / maxB) * 100}%` }}><div className="bar"><i className="seg-done" style={{ flex: d }} /><i className="seg-prog" style={{ flex: pr }} /><i className="seg-ns" style={{ flex: arr.length - d - pr }} /></div></div>
                  <span className="c">{arr.length}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <h3>Most represented seasons</h3>
          {seasons.map(([s, arr]) => (
            <div key={s} className="hbar" onClick={() => router.push('/stock?season=' + encodeURIComponent(s))}><span className="lbl">{s}</span><div style={{ width: `${(arr.length / maxS) * 100}%` }}><div className="bar"><i className="seg-done" style={{ flex: 1 }} /></div></div><span className="c">{arr.length}</span></div>
          ))}
          <div className="grid g2" style={{ marginTop: 16 }}>
            <div><div className="eyebrow" style={{ marginBottom: 6 }}>By decade</div>
              {decC.map(([d, c]) => <div key={d} className="hbar" style={{ gridTemplateColumns: '70px 1fr 30px', cursor: 'default' }}><span className="lbl">{d}</span><div style={{ width: `${(c / maxD) * 100}%` }}><div className="bar"><i className="seg-done" style={{ flex: 1, opacity: 0.75 }} /></div></div><span className="c">{c}</span></div>)}
            </div>
            <div><div className="eyebrow" style={{ marginBottom: 6 }}>By season type</div>
              {data.vocab.seasonTypes.map((t) => [t, ps.filter((p) => p.seasonType === t).length] as const).filter((x) => x[1]).map(([t, c]) => (
                <div key={t} className="row between small" style={{ padding: '4px 0', borderBottom: '1px solid var(--rule-2)' }}><span>{t}</span><span>{c} · {pct(c, n)}%</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>Where to work next</h3>
          <p className="muted small" style={{ margin: '-4px 0 10px' }}>Brands ranked by items still without approved copy. The top season shows which collection to work on first.</p>
          <table><thead><tr><th>Brand</th><th className="num">Left</th><th className="num">With gaps</th><th>Start with</th><th /></tr></thead><tbody>
            {prio.map((x) => <tr key={x.b}><td className="t">{titleCase(x.b)}</td><td className="num">{x.rem} / {x.total}</td><td className="num">{x.gaps || '-'}</td><td className="small">{x.top}</td><td><Link className="btn sm" href={`/ingestion?brand=${encodeURIComponent(x.b)}`}>Open queue</Link></td></tr>)}
          </tbody></table>
        </div>
        <div className="card">
          <h3>Boutiques</h3>
          <table><thead><tr><th>Boutique</th><th className="num">Items</th><th style={{ width: '30%' }}>Approved</th><th className="num">With gaps</th><th>Last import</th></tr></thead><tbody>
            {data.boutiques.map((b) => {
              const a = ps.filter((p) => p.boutiqueId === b.id), d = a.filter((p) => DONE.includes(p.status)).length;
              return <tr key={b.id} className="click" onClick={() => router.push('/stock?b=' + b.id)}><td className="t">{b.name}</td><td className="num">{a.length}</td><td><div className="row" style={{ flexWrap: 'nowrap' }}><div className="bar" style={{ flex: 1 }}><i className="seg-done" style={{ width: pct(d, a.length) + '%' }} /></div><span className="small">{pct(d, a.length)}%</span></div></td><td className="num">{a.filter((p) => readiness(p).missing.length).length || '-'}</td><td className="id">{b.imported || '-'}</td></tr>;
            })}
          </tbody></table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14, overflow: 'auto' }}>
        <h3>Brand × decade</h3>
        <p className="muted small" style={{ margin: '-4px 0 10px' }}>Where the stock clusters in time: the dense cells are the collections to research and record first.</p>
        <table className="heat"><thead><tr><th />{decs.map((d) => <th key={d}>{d}</th>)}</tr></thead><tbody>
          {heat.map(([b, rowv]) => <tr key={b}><th className="r">{titleCase(b)}</th>{rowv.map((c, i) => <td key={i} style={{ background: c ? `rgba(17,17,17,${0.08 + (0.85 * c) / heatMax})` : 'var(--track)', color: c / heatMax > 0.45 ? '#fff' : 'var(--ink-2)' }}>{c || ''}</td>)}</tr>)}
        </tbody></table>
      </div>
      {lb.node}
    </>
  );
}
