import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from '@/i18n/config';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

const PUBLIC_PATHS = ['/login', '/splash'];

// Uses Web Crypto API (Edge Runtime compatible) instead of jose, which pulls
// in CompressionStream — a Node.js API unavailable in Edge Runtime.
async function isValidToken(token: string): Promise<boolean> {
  try {
    const [header, payload, sig] = token.split('.');
    if (!header || !payload || !sig) return false;

    const secret = process.env.JWT_SECRET ?? 'fallback-secret-change-in-production';
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const b64url = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/');
    const sigBytes = Uint8Array.from(atob(b64url(sig)), (c) => c.charCodeAt(0));
    const data = new TextEncoder().encode(`${header}.${payload}`);
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, data);
    if (!valid) return false;

    const claims = JSON.parse(atob(b64url(payload)));
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return false;

    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/') || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  const localeMatch = pathname.match(new RegExp(`^/(${locales.join('|')})(/.*)$`));
  const locale = localeMatch ? localeMatch[1] : defaultLocale;
  const subpath = localeMatch ? (localeMatch[2] || '/') : pathname;

  const isPublic = PUBLIC_PATHS.some(
    (p) => subpath === p || subpath.startsWith(`${p}/`)
  );

  if (!isPublic) {
    const token = req.cookies.get('hp_token')?.value;
    if (!token || !(await isValidToken(token))) {
      const splashUrl = new URL(`/${locale}/splash`, req.url);
      return NextResponse.redirect(splashUrl);
    }
  }

  const response = intlMiddleware(req);
  if (!isPublic) {
    // Prevent bfcache from storing authenticated pages — browsers won't restore
    // a no-store page from cache, forcing a real network request (and middleware
    // re-check) on every visit including Back/Forward navigation.
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
