import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth';
import { query } from '@/lib/db';

async function ensureCart(patientId: string): Promise<number> {
  const ex = await query<{ id: number }>(
    `SELECT id FROM carts WHERE patient_id = $1 AND status = 'open' LIMIT 1`,
    [patientId],
  );
  if (ex.rows.length) return ex.rows[0].id;
  const cr = await query<{ id: number }>(
    `INSERT INTO carts (patient_id) VALUES ($1) RETURNING id`,
    [patientId],
  );
  return cr.rows[0].id;
}

// Price lookup — read-only queries against existing inventory/pharmacy tables.
// Priority:
//   0. items.selling_price via items.name               (local inventory; copied from drugs.selling_price at link time)
//   0b. drugs.selling_price via drugs.name              (Neon master price; fallback if drug not yet in items)
//   1. pharmacy_order_items direct (for disp:UUID items where orderid is known)
//   2. drug_batches.sellingprice via drugs.name          (inventory stock price)
//   3. pos_sale_items.unitprice via drugname             (actual POS sale price)
//   4. pharmacy_order_items.unitprice via drugname       (prescription order price)
//   5. pharmacy_invoice_lines.unitprice via description  (invoice price)
//   6. medications_catalog.price                         (admin-maintained fallback)
async function catalogPrice(name: string, medicationId?: string): Promise<number | null> {
  // Step 0: items.selling_price — local inventory table.
  // Join: cart medication name → items.name (direct fuzzy match).
  // items.drug_id = drugs.drugid links back to the Neon drug catalog.
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

  // Step 0b: drugs.selling_price — Neon master catalog.
  // Fallback for drugs not yet linked into the local items table.
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
  } catch { /* drugs table absent or selling_price column missing */ }

  // Step 1: item_batches.selling_price via items.name
  // items.drug_id = drugs.drugid is the catalog join; name match used here for flexibility.
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

  // Fast path for dispensed items — the UUID in disp:UUID is pharmacy_order_items.orderid
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
    } catch { /* fall through to name-based lookup */ }
  }

  // 1. Inventory: drug_batches.sellingprice (join via drugs.name / genericname)
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

  // 2. POS sales: pos_sale_items.unitprice (exact-name match first, then partial)
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

// GET /api/cart — open cart with all items
// Items with no stored price_snapshot get a live price lookup so the cart always
// shows the current price even for items added before this feature was deployed.
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await query<{
    cart_id: number; item_id: number; medication_id: string;
    name_snapshot: string; quantity: number; group_id: string | null;
    group_name: string | null; price_snapshot: string | null;
  }>(
    `SELECT c.id AS cart_id,
            ci.id AS item_id,
            ci.medication_id,
            ci.name_snapshot,
            ci.quantity,
            ci.group_id,
            ci.group_name,
            ci.price_snapshot
     FROM carts c
     LEFT JOIN cart_items ci ON ci.cart_id = c.id
     WHERE c.patient_id = $1 AND c.status = 'open'
     ORDER BY ci.id ASC`,
    [session.patientId],
  );

  if (!result.rows.length || result.rows[0].cart_id == null) {
    return NextResponse.json({ cartId: null, items: [], totalItems: 0 });
  }

  const cartId = result.rows[0].cart_id;
  const items = await Promise.all(
    result.rows
      .filter((r) => r.item_id != null)
      .map(async (r) => {
        const stored = r.price_snapshot != null ? Number(r.price_snapshot) : null;
        const price  = stored ?? await catalogPrice(r.name_snapshot, r.medication_id);
        return {
          itemId:       r.item_id,
          medicationId: r.medication_id,
          name:         r.name_snapshot,
          quantity:     r.quantity,
          groupId:      r.group_id,
          groupName:    r.group_name,
          price,
        };
      }),
  );

  return NextResponse.json({ cartId, items, totalItems: items.length });
}

// POST /api/cart — add one or more items
const itemSchema = z.object({
  medicationId: z.string().min(1),
  name:         z.string().min(1),
  groupId:      z.string().nullish(),
  groupName:    z.string().nullish(),
});
const addSchema = z.object({ items: z.array(itemSchema).min(1) });

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = addSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const cartId = await ensureCart(session.patientId);

  for (const item of parsed.data.items) {
    const price = await catalogPrice(item.name, item.medicationId);
    await query(
      `INSERT INTO cart_items
         (cart_id, medication_id, name_snapshot, quantity, group_id, group_name, price_snapshot)
       VALUES ($1, $2, $3, 1, $4, $5, $6)
       ON CONFLICT (cart_id, medication_id)
       DO UPDATE SET quantity = cart_items.quantity + 1`,
      [cartId, item.medicationId, item.name, item.groupId ?? null, item.groupName ?? null, price],
    );
  }

  return NextResponse.json({ ok: true, added: parsed.data.items.length });
}
