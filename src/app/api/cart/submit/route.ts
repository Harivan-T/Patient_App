import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { query } from '@/lib/db';

// Same lookup chain as cart/route.ts — read-only, no writes to inventory tables.
// 0 → items.selling_price (local inventory, price copied from drugs.selling_price at link time)
// 0b → drugs.selling_price (Neon master; fallback when drug not yet in items)
// then existing chain …
async function catalogPrice(name: string, medicationId?: string): Promise<number | null> {
  // Step 0: items.selling_price — local inventory.
  // cart name → items.name (fuzzy); items.drug_id = drugs.drugid is the catalog join key.
  try {
    const r = await query<{ price: string | null }>(
      `SELECT i.selling_price AS price
       FROM items i
       WHERE i.selling_price IS NOT NULL AND i.selling_price > 0
         AND (LOWER(i.name)            = LOWER($1)
              OR LOWER(i.generic_name) = LOWER($1)
              OR LOWER($1) LIKE '%' || LOWER(i.name) || '%'
              OR LOWER(i.name) LIKE '%' || LOWER($1) || '%')
       ORDER BY CASE WHEN LOWER(i.name) = LOWER($1) THEN 0 ELSE 1 END
       LIMIT 1`,
      [name],
    );
    if (r.rows[0]?.price != null) return Number(r.rows[0].price);
  } catch { /* items table absent or selling_price column not yet present */ }

  // Step 0b: drugs.selling_price — Neon master.
  try {
    const r = await query<{ price: string | null }>(
      `SELECT d.selling_price AS price
       FROM drugs d
       WHERE d.selling_price IS NOT NULL AND d.selling_price > 0
         AND (LOWER(d.name)        = LOWER($1)
              OR LOWER(d.genericname) = LOWER($1)
              OR LOWER($1) LIKE '%' || LOWER(d.name) || '%'
              OR LOWER(d.name) LIKE '%' || LOWER($1) || '%')
       ORDER BY CASE WHEN LOWER(d.name) = LOWER($1) THEN 0 ELSE 1 END
       LIMIT 1`,
      [name],
    );
    if (r.rows[0]?.price != null) return Number(r.rows[0].price);
  } catch { /* drugs.selling_price column missing */ }

  // Step 1: item_batches.selling_price via items.name
  try {
    const r = await query<{ price: string | null }>(
      `SELECT MAX(ib.selling_price) AS price
       FROM item_batches ib
       JOIN items i ON i.id = ib.item_id
       WHERE ib.selling_price IS NOT NULL AND ib.selling_price > 0
         AND (LOWER(i.name)            = LOWER($1)
              OR LOWER(i.generic_name) = LOWER($1)
              OR LOWER($1) LIKE '%' || LOWER(i.name) || '%'
              OR LOWER(i.name) LIKE '%' || LOWER($1) || '%')`,
      [name],
    );
    if (r.rows[0]?.price != null) return Number(r.rows[0].price);
  } catch { /* item_batches or items table absent */ }

  if (medicationId?.startsWith('disp:')) {
    const orderId = medicationId.slice(5);
    try {
      const r = await query<{ price: string | null }>(
        `SELECT unitprice AS price
         FROM pharmacy_order_items
         WHERE orderid = $1::uuid
           AND unitprice IS NOT NULL AND unitprice > 0
           AND LOWER(drugname) = LOWER($2)
         LIMIT 1`,
        [orderId, name],
      );
      if (r.rows[0]?.price != null) return Number(r.rows[0].price);
    } catch { /* fall through */ }
  }

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

// POST /api/cart/submit
export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cart = await query<{
    cart_id: number; item_id: number; medication_id: string;
    name_snapshot: string; quantity: number; group_name: string | null;
    price_snapshot: string | null;
  }>(
    `SELECT c.id AS cart_id,
            ci.id AS item_id,
            ci.medication_id,
            ci.name_snapshot,
            ci.quantity,
            ci.group_name,
            ci.price_snapshot
     FROM carts c
     JOIN cart_items ci ON ci.cart_id = c.id
     WHERE c.patient_id = $1 AND c.status = 'open'
     ORDER BY ci.id`,
    [session.patientId],
  );

  if (!cart.rows.length) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }

  const cartId = cart.rows[0].cart_id;

  // Resolve price for each item: use stored snapshot, or look up live if missing.
  // This ensures items added before price lookup was wired still get a snapshot.
  const items = await Promise.all(
    cart.rows.map(async (r) => {
      const stored = r.price_snapshot != null ? Number(r.price_snapshot) : null;
      const price  = stored ?? await catalogPrice(r.name_snapshot, r.medication_id);
      return { ...r, price };
    }),
  );

  const allPriced = items.every((r) => r.price != null);
  const total = allPriced
    ? items.reduce((s, r) => s + (r.price ?? 0) * r.quantity, 0)
    : null;

  const order = await query<{ id: number }>(
    `INSERT INTO orders (patient_id, total) VALUES ($1, $2) RETURNING id`,
    [session.patientId, total],
  );
  const orderId = order.rows[0].id;

  for (const item of items) {
    await query(
      `INSERT INTO order_items
         (order_id, medication_id, name_snapshot, quantity, group_name_snapshot, price_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orderId, item.medication_id, item.name_snapshot, item.quantity, item.group_name, item.price],
    );
  }

  await query(`UPDATE carts SET status = 'submitted' WHERE id = $1`, [cartId]);
  await query(`INSERT INTO carts (patient_id) VALUES ($1)`, [session.patientId]);

  return NextResponse.json({ ok: true, orderId, itemCount: items.length, total });
}
