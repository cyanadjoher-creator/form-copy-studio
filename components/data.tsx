'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Boutique, Product, Prompt, Ref, Vocab } from '@/lib/domain';

export type Env = { database: string; storage: string; ai: string; model: string; vercel: boolean };
type Data = { products: Product[]; boutiques: Boutique[]; vocab: Vocab; refs: Ref[]; prompts: Prompt[]; env: Env };
type Ctx = {
  data: Data | null; error: string;
  reload: () => Promise<void>;
  setProduct: (p: Product) => void; removeProduct: (id: string) => void;
  patch: (fn: (d: Data) => Data) => void;
  toast: (msg: string) => void;
};
const DataCtx = createContext<Ctx | null>(null);

/** fetch wrapper: JSON in and out, throws the server's error message. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method || (opts.body || opts.form ? 'POST' : 'GET'),
    headers: opts.form ? undefined : { 'Content-Type': 'application/json' },
    body: opts.form || (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not signed in'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
  return j as T;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    try { setData(await api<Data>('/api/bootstrap')); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load'); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const toast = useCallback((m: string) => {
    setMsg(m); if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(''), 3200);
  }, []);
  const patch = useCallback((fn: (d: Data) => Data) => setData((d) => (d ? fn(d) : d)), []);
  const setProduct = useCallback((p: Product) => patch((d) => {
    const i = d.products.findIndex((x) => x.id === p.id);
    const products = [...d.products];
    if (i >= 0) products[i] = p; else products.unshift(p);
    return { ...d, products };
  }), [patch]);
  const removeProduct = useCallback((id: string) => patch((d) => ({ ...d, products: d.products.filter((x) => x.id !== id) })), [patch]);

  return (
    <DataCtx.Provider value={{ data, error, reload, setProduct, removeProduct, patch, toast }}>
      {children}
      <div className={'toast' + (msg ? ' show' : '')} role="status" aria-live="polite">{msg}</div>
    </DataCtx.Provider>
  );
}

export function useData() {
  const c = useContext(DataCtx);
  if (!c) throw new Error('useData outside DataProvider');
  return c;
}
