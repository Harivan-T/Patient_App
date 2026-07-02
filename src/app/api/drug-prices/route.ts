import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { query } from '@/lib/db';

// POST /api/drug-prices
// Body: { names: string[] }
// Returns: Record<string, number | null>  (drug name → IQD price or null)
//
// Lookup order per drug:
//   1. pharmacy_order_items.price  (EHR/pharmacy system)
//   2. hospital_items.price        (hospital ERP)
//   3. medications_catalog.price   (admin-maintained fallback)
export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const names: string[] = Array.isArray(body?.names) ? body.names : [];
  if (!names.length) return NextResponse.json({});

  const result: Record<string, number | null> = {};

  for (const name of names) {
    result[name] = await lookupPrice(name);
  }

  return NextResponse.json(result);
}

async function lookupPrice(name: string): Promise<number | null> {
  // 1. pharmacy_order_items
  try {
    const r = await query<{ price: string | null }>(
      `SELECT MAX(poi.price) AS price
       FROM pharmacy_order_items poi
       WHERE poi.price IS NOT NULL
         AND (LOWER(poi.drugname) = LOWER($1)
              OR LOWER($1) LIKE '%' || LOWER(poi.drugname) || '%'
              OR LOWER(poi.drugname) LIKE '%' || LOWER($1) || '%')`,
      [name],
    );
    if (r.rows.length && r.rows[0].price != null) return Number(r.rows[0].price);
  } catch { /* column absent */ }

  // 2. hospital_items
  try {
    const r = await query<{ price: string | null }>(
      `SELECT hi.price
       FROM hospital_items hi
       WHERE hi.price IS NOT NULL
         AND (LOWER(COALESCE(hi.name, '')) = LOWER($1)
              OR LOWER($1) LIKE '%' || LOWER(COALESCE(hi.name, '')) || '%'
              OR LOWER(COALESCE(hi.name, '')) LIKE '%' || LOWER($1) || '%'
              OR LOWER(COALESCE(hi.generic_name, '')) = LOWER($1))
       LIMIT 1`,
      [name],
    );
    if (r.rows.length && r.rows[0].price != null) return Number(r.rows[0].price);
  } catch { /* column absent */ }

  // 3. medications_catalog
  try {
    const r = await query<{ price: string | null }>(
      `SELECT price FROM medications_catalog
       WHERE available = TRUE AND price IS NOT NULL AND (
         LOWER(name) = LOWER($1)
         OR LOWER($1) LIKE '%' || LOWER(name) || '%'
         OR LOWER(name) LIKE '%' || LOWER($1) || '%'
         OR LOWER(SPLIT_PART($1::TEXT, ' ', 1)) = LOWER(name)
       )
       ORDER BY
         CASE
           WHEN LOWER(name) = LOWER($1)                       THEN 0
           WHEN LOWER($1) LIKE '%' || LOWER(name) || '%'     THEN 1
           ELSE 2
         END
       LIMIT 1`,
      [name],
    );
    if (r.rows.length && r.rows[0].price != null) return Number(r.rows[0].price);
  } catch { /* table absent */ }

  return null;
}
