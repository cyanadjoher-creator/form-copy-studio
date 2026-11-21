'use client';
import { useEffect, useState } from 'react';
import { readiness, titleCase, type Product } from '@/lib/domain';

export const stageCls = (s: string) => 'pill s-' + s.replace(/\s/g, '-');
export const sizeLabel = (p: Product) => [p.sizeSystem, p.size].filter(Boolean).join(' ') || '-';
export const cover = (p: Product) => p.photos[0]?.url || '';
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export function StagePill({ s }: { s: string }) { return <span className={stageCls(s)}>{s}</span>; }

export function FieldsBadge({ p }: { p: Product }) {
  const r = readiness(p);
  if (!r.missing.length && !r.conflicts.length && !r.tocheck.length) return <span className="pill s-Approved">complete</span>;
  return (
    <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
      {!!r.conflicts.length && <span className="pill p-bad" title={r.conflicts.join(', ')}>{r.conflicts.length} conflict{r.conflicts.length > 1 ? 's' : ''}</span>}
      {!!r.missing.length && <span className="pill p-mute" title={r.missing.join(', ')}>{r.missing.length} missing</span>}
      {!!r.tocheck.length && <span className="pill s-Drafted" title={r.tocheck.join(', ')}>{r.tocheck.length} to check</span>}
    </span>
  );
}

/** Full-size view of a product's photos with arrows, thumbnails and keyboard navigation. */
export function Lightbox({ p, start, onClose }: { p: Product; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const n = p.photos.length;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => Math.min(n - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [n, onClose]);
  const ph = p.photos[i];
  if (!ph) return null;
  return (
    <div className="modal-bg show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-label={p.name}>
        <div className="row between"><div><div className="eyebrow">{titleCase(p.brand)} · {p.season}</div><h2 style={{ margin: '4px 0 0' }}>{p.name}</h2></div><button className="btn sm ghost" onClick={onClose}>Close</button></div>
        <div className="lb">
          <button className="btn ghost" disabled={!i} onClick={() => setI(i - 1)} aria-label="Previous">←</button>
          <figure><img src={ph.url} alt={`${p.name}, ${ph.role}`} /><figcaption>{i + 1} / {n} · {ph.role}</figcaption></figure>
          <button className="btn ghost" disabled={i >= n - 1} onClick={() => setI(i + 1)} aria-label="Next">→</button>
        </div>
        <div className="strip" style={{ justifyContent: 'center' }}>
          {p.photos.map((x, j) => <img key={x.id} src={x.url} alt="" className={j === i ? 'on' : ''} onClick={() => setI(j)} />)}
        </div>
      </div>
    </div>
  );
}

/** Hook: which product's lightbox is open. */
export function useLightbox() {
  const [lb, setLb] = useState<{ p: Product; i: number } | null>(null);
  const node = lb ? <Lightbox p={lb.p} start={lb.i} onClose={() => setLb(null)} /> : null;
  return { open: (p: Product, i = 0) => setLb({ p, i }), node };
}
