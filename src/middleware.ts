import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC = ['/login', '/register', '/forgot-password'];
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me-in-production-32ch');

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/')) {
    // CSRF defence-in-depth for cookie auth: state-changing requests must be same-origin
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.get('origin');
      if (origin && new URL(origin).host !== req.headers.get('host')) return NextResponse.json({ ok: false, error: { code: 'CSRF', message: 'Cross-origin request blocked' } }, { status: 403 });
    }
    return NextResponse.next();
  }
  const token = req.cookies.get('orbit_session')?.value;
  let valid = false;
  if (token) { try { await jwtVerify(token, secret()); valid = true; } catch { /* invalid */ } }
  const isPublic = PUBLIC.some((p) => pathname === p);
  if (!valid && !isPublic) {
    const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    const res = NextResponse.redirect(url); if (token) res.cookies.set('orbit_session', '', { path: '/', maxAge: 0 });
    return res;
  }
  // Session cookie was rejected by the app (user deleted / reseeded / suspended): drop it and show the login page
  if (isPublic && req.nextUrl.searchParams.has('expired')) { const res = NextResponse.next(); res.cookies.set('orbit_session', '', { path: '/', maxAge: 0 }); return res; }
  if (valid && isPublic) { const url = req.nextUrl.clone(); url.pathname = '/dashboard'; url.search = ''; return NextResponse.redirect(url); }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'] };
