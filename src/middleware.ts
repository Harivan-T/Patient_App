import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from '@/i18n/config';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

const PUBLIC_PATHS = ['/login'];

// Edge-runtime JWT verification using Web Crypto (no Node.js APIs)
async function isValidToken(token: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [headerB64, payloadB64, sigB64] = parts;

    const secret = process.env.JWT_SECRET ?? 'fallback-secret-change-in-production';
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const b64ToBytes = (b: string) => {
      const bin = atob(b.replace(/-/g, '+').replace(/_/g, '/'));
      return Uint8Array.from(bin, (c) => c.charCodeAt(0));
    };

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64ToBytes(sigB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    );
    if (!valid) return false;

    const payload = JSON.parse(new TextDecoder().decode(b64ToBytes(payloadB64)));
    return typeof payload.exp === 'number' && payload.exp > Date.now() / 1000;
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
      const loginUrl = new URL(`/${locale}/login`, req.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
