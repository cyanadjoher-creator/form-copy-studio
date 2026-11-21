'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useData, api } from './data';
import { DONE } from '@/lib/domain';

export function Sidebar() {
  const path = usePathname();
  const { data } = useData();
  const n = data?.products.length ?? 0;
  const items: [string, string, string | number][] = [
    ['/', 'Overview', ''],
    ['/stock', 'Boutique stock', n],
    ['/brands', 'Products by brand', data ? new Set(data.products.map((p) => p.brand)).size : ''],
    ['/codes', 'Product code', data?.refs.length ?? ''],
    ['/ingestion', 'Ingestion', data ? data.products.filter((p) => !DONE.includes(p.status)).length : ''],
    ['/prompt', 'Copy prompt', data ? 'v' + (data.prompts.find((p) => p.active)?.v ?? '') : ''],
    ['/vocabulary', 'Vocabulary', ''],
  ];
  const on = (h: string) => (h === '/' ? path === '/' : path.startsWith(h));
  return (
    <aside className="side">
      <div className="brand"><b>FORM</b><span>Copy studio</span></div>
      <nav className="nav">
        <div className="nav-h">Copy pipeline</div>
        {items.map(([h, l, c]) => (
          <Link key={h} href={h} className={on(h) ? 'on' : ''}>{l}<span className="n">{c}</span></Link>
        ))}
      </nav>
      <div className="side-foot">
        {data && <div>Model: {data.env.ai === 'none' ? 'not configured' : `${data.env.ai} · ${data.env.model}`}</div>}
        <button className="btn sm ghost" onClick={async () => { await api('/api/logout', { method: 'POST' }); window.location.href = '/login'; }}>Sign out</button>
      </div>
    </aside>
  );
}
