'use client';
import { useState } from 'react';

export default function Login() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    if (res.ok) { const next = new URLSearchParams(window.location.search).get('next'); window.location.href = next && next.startsWith('/') ? next : '/'; }
    else { setErr('Wrong password'); setBusy(false); }
  }
  return (
    <main className="login">
      <div className="brand" style={{ padding: 0 }}><b>FORM</b><span>Copy studio</span></div>
      <form onSubmit={submit} style={{ marginTop: 28 }}>
        <label className="f" htmlFor="pw">Team password</label>
        <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        {err && <p className="small" style={{ color: 'var(--bad-ink)' }}>{err}</p>}
        <button className="btn dark" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} disabled={busy}>Sign in</button>
      </form>
    </main>
  );
}
