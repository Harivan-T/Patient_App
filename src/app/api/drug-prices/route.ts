import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { catalogPrice } from '@/lib/pricing';

// POST /api/drug-prices
// Body: { names: string[] }
// Returns: Record<string, number | null>
//
// Uses the shared catalogPrice() lookup chain (see src/lib/pricing.ts) so the
// price shown on the medications page always matches the cart.

const MAX_NAMES = 100;

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { names?: unknown } | null;
  const names: string[] = Array.isArray(body?.names)
    ? (body.names as unknown[]).filter((n): n is string => typeof n === 'string').slice(0, MAX_NAMES)
    : [];
  if (!names.length) return NextResponse.json({});

  const prices = await Promise.all(names.map((name) => catalogPrice(name)));
  const result: Record<string, number | null> = {};
  names.forEach((name, i) => { result[name] = prices[i]; });

  return NextResponse.json(result);
}
