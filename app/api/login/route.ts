import { NextResponse } from 'next/server';
import { COOKIE, authEnabled, tokenFor } from '@/lib/auth';

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: '' }));
  if (authEnabled() && password !== process.env.APP_PASSWORD) return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await tokenFor(), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return res;
}
