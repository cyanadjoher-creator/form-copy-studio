'use client';
import { useData } from './data';

/** Waits for the first load and shows setup warnings (temporary database, no model). */
export function Gate({ children }: { children: React.ReactNode }) {
  const { data, error, reload } = useData();
  if (error) return <div className="card"><h3>Could not load the studio</h3><p className="small">{error}</p><button className="btn" onClick={reload}>Try again</button></div>;
  if (!data) return <p className="muted">Loading…</p>;
  const warn: string[] = [];
  if (data.env.vercel && data.env.database === 'local') warn.push('No database connected: changes are temporary. In Vercel, open Storage and connect a Neon (Postgres) database: it also holds the photos.');
  if (data.env.ai === 'none') warn.push('No model configured: Fill fields and Generate copy will not run. Add ANTHROPIC_API_KEY in the Vercel project settings.');
  return <>{warn.map((w) => <div className="banner" key={w}>{w}</div>)}{children}</>;
}
