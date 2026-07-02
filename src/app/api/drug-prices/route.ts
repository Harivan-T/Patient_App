import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { query } from '@/lib/db';

// POST /api/drug-prices
// Body: { names: string[] }
// Returns: Record<string, number | null>
//
// Lookup order per drug name (all read-only):
//   1. drug_batches.sellingprice via drugs.name/genericname   (inventory)
//   2. pos_sale_items.unitprice via drugname                  (POS sales)
//   3. pharmacy_order_items.unitprice via drugname            (pharmacy orders)
//   4. pharmacy_invoice_lines.unitprice via description       (invoices)
//   5. medications_catalog.price                              (admin fallback)

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { names?: unknown } | null;
  const names: string[] = Array.isArray(body?.names) ? (body.names as string[]) : [];
  if (!names.length) return NextResponse.json({});

  const result: Record<string, number | null> = {};
  for (const name of names) {
    result[name] = await lookupPrice(name);
  }

  return NextResponse.json(result);
}

async function lookupPrice(name: string): Promise<number | null> {
  // 1. Inventory: drug_batches.sellingprice via drugs.name / genericname
  try {
    const r = await query<{ price: string | null }>(
      `SELECT MAX(b.sellingprice) AS price
       FROM drug_batches b
       JOIN drugs d ON d.drugid = b.drugid
       WHERE b.sellingprice IS NOT NULL AND b.sellingprice > 0
         AND (LOWER(d.name)        = LOWER($1)
              OR LOWER(d.genericname) = LOWER($1)
              OR LOWER($1) LIKE '%' || LOWER(d.name) || '%'
              OR LOWER(d.name) LIKE '%' || LOWER($1) || '%')`,
      [name],
    );
    if (r.rows[0]?.price != null) return Number(r.rows[0].price);
  } catch { /* table absent */ }

  // 2. POS sales: pos_sale_items.unitprice via drugname
  try {
    const r = await query<{ price: string | null }>(
      `SELECT unitprice AS price
       FROM pos_sale_items
       WHERE unitprice IS NOT NULL AND unitprice > 0
         AND (LOWER(drugname) = LOWER($1)
              OR LOWER($1) LIKE '%' || LOWER(drugname) || '%'
              OR LOWER(drugname) LIKE '%' || LOWER($1) || '%')
       ORDER BY CASE WHEN LOWER(drugname) = LOWER($1) THEN 0 ELSE 1 END,
                unitprice DESC
       LIMIT 1`,
      [name],
    );
    if (r.rows[0]?.price != null) return Number(r.rows[0].price);
  } catch { /* table absent */ }

  // 3. Pharmacy orders: pharmacy_order_items.unitprice via drugname
  try {
    const r = await query<{ price: string | null }>(
      `SELECT MAX(unitprice) AS price
       FROM pharmacy_order_items
       WHERE unitprice IS NOT NULL AND unitprice > 0
         AND (LOWER(drugname) = LOWER($1)
              OR LOWER($1) LIKE '%' || LOWER(drugname) || '%'
              OR LOWER(drugname) LIKE '%' || LOWER($1) || '%')`,
      [name],
    );
    if (r.rows[0]?.price != null) return Number(r.rows[0].price);
  } catch { /* table absent */ }

  // 4. Invoice lines: pharmacy_invoice_lines.unitprice via description
  try {
    const r = await query<{ price: string | null }>(
      `SELECT MAX(unitprice) AS price
       FROM pharmacy_invoice_lines
       WHERE unitprice IS NOT NULL AND unitprice > 0
         AND (LOWER(description) = LOWER($1)
              OR LOWER($1) LIKE '%' || LOWER(description) || '%'
              OR LOWER(description) LIKE '%' || LOWER($1) || '%')`,
      [name],
    );
    if (r.rows[0]?.price != null) return Number(r.rows[0].price);
  } catch { /* table absent */ }

  // 5. Admin fallback: medications_catalog
  try {
    const r = await query<{ price: string | null }>(
      `SELECT price FROM medications_catalog
       WHERE available = TRUE AND price IS NOT NULL
         AND (LOWER(name) = LOWER($1)
              OR LOWER($1) LIKE '%' || LOWER(name) || '%'
              OR LOWER(name) LIKE '%' || LOWER($1) || '%')
       ORDER BY CASE WHEN LOWER(name) = LOWER($1) THEN 0 ELSE 1 END
       LIMIT 1`,
      [name],
    );
    if (r.rows[0]?.price != null) return Number(r.rows[0].price);
  } catch { /* table absent */ }

  return null;
}
