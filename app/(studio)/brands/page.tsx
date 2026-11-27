'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useData } from '@/components/data';
import { pct, StagePill, useLightbox } from '@/components/ui';
import { DONE, titleCase, type Product } from '@/lib/domain';

export default function BrandsPage() { return <Suspense><Brands /></Suspense>; }

function Brands() {
  const { data } = useData();
  const router = useRouter();
  const sp = useSearchParams();
  const lb = useLightbox();
  const [sel, setSel] = useState(sp.get('b') || '');
  if (!data) return null;
  const m: Record<string, Product[]> = {};
  data.products.forEach((p) => (m[p.brand] ||= []).push(p));
  const names = Object.keys(m).sort((a, b) => a.localeCompare(b));
  const brand = m[sel] ? sel : names[0];
  const arr = (m[brand] || []).slice().sort((a, b) => (a.year || 9999) - (b.year || 9999));
  const d = arr.filter((p) => DONE.includes(p.status)).length;
  const ss: Record<string, number> = {}; arr.forEach((p) => (ss[p.season] = (ss[p.season] || 0) + 1));
  const bs = [...new Set(arr.map((p) => data.boutiques.find((b) => b.id === p.boutiqueId)?.name))];
  return (
    <>
      <div className="eyebrow">Catalogue · by brand</div><h1>Products by brand</h1>
      <p className="lede">Every item grouped by house, with the boutique it comes from, its photos and its current copy. Click an item to open it in Ingestion.</p>
      <p className="small"><a href="/api/export">Export the validated product pages (Excel)</a> · <a href="/api/export?scope=review">with pieces in review</a></p>
      <div className="brands">
        <div className="card blist" style={{ padding: 10 }}>{names.map((n) => <a key={n} className={n === brand ? 'on' : ''} onClick={() => setSel(n)}><span>{titleCase(n)}</span><span className="n">{m[n].length}</span></a>)}</div>
        <div className="card">
          <div className="row between"><div><div className="eyebrow">{arr.length} items · {bs.length} boutique{bs.length > 1 ? 's' : ''}</div><h2 style={{ margin: '6px 0 4px' }}>{titleCase(brand || '')}</h2></div>
            <button className="btn sm" onClick={() => router.push('/ingestion?brand=' + encodeURIComponent(brand))}>Open this brand&apos;s queue</button></div>
          <div className="row" style={{ margin: '6px 0 12px', flexWrap: 'nowrap' }}><div className="bar" style={{ flex: 1 }}><i className="seg-done" style={{ width: pct(d, arr.length) + '%' }} /></div><span className="small">{d}/{arr.length} approved</span></div>
          <div className="chips tags">{Object.entries(ss).sort((a, b) => b[1] - a[1]).map(([s, c]) => <span key={s} className="chip" style={{ cursor: 'default' }}>{s}<span className="n">{c}</span></span>)}</div>
          {arr.map((p) => (
            <div key={p.id} className="pcard" onClick={() => router.push('/ingestion/' + p.id)}>
              <div>
                <div className="row"><b>{p.name}</b><StagePill s={p.status} />{p.needsInfo && <span className="pill p-bad">needs info</span>}</div>
                <div className="mono small muted" style={{ marginTop: 3 }}>{[p.sku || p.productCode, p.season, data.boutiques.find((b) => b.id === p.boutiqueId)?.name].filter(Boolean).join(' · ')}</div>
                {!!p.photos.length && <div className="strip" style={{ marginTop: 10 }}>{p.photos.map((x, j) => <img key={x.id} src={x.url} alt={x.role} title={x.role} onClick={(e) => { e.stopPropagation(); lb.open(p, j); }} />)}</div>}
                {p.copy ? <pre>{p.copy}</pre> : <p className="muted small" style={{ margin: '8px 0 0' }}>No copy yet.</p>}
              </div>
              <div className="small muted" style={{ textAlign: 'right' }}>{p.photos.length} photos<br />{p.sources.length ? `${p.sources.length} sources` : ''}<br />{p.promptV ? 'prompt v' + p.promptV : ''}<br />{p.updated}</div>
            </div>
          ))}
        </div>
      </div>
      {lb.node}
    </>
  );
}
