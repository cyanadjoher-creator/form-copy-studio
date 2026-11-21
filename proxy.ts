import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, validToken } from './lib/auth';

// Everything sits behind the shared password, photos included, except the login page itself.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/login' || pathname === '/api/login' || pathname === '/api/health') return NextResponse.next();
  if (await validToken(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
