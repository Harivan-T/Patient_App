import { query } from '@/lib/db';

// Price lookup — read-only queries against existing inventory/pharmacy tables.
// Single source of truth used by /api/cart, /api/cart/submit, and /api/drug-prices.
//
// Priority:
//   0.  items.selling_price via items.name               (local inventory; copied from drugs.selling_price at link time)
//   0b. drugs.selling_price via drugs.name               (Neon master price; fallback if drug not yet in items)
//   1.  item_batches.selling_price via items.name        (local inventory batches)
//   1b. pharmacy_order_items direct                      (for disp:UUID items where orderid is known)
//   2.  drug_batches.sellingprice via drugs.name         (inventory stock price)
//   3.  pos_sale_items.unitprice via drugname            (actual POS sale price)
//   4.  pharmacy_order_items.unitprice via drugname      (prescription order price)
//   5.  pharmacy_invoice_lines.unitprice via description (invoice price)
//   6.  medications_catalog.price                        (admin-maintained fallback)
export async function catalogPrice(name: string, medicationId?: string): Promise<number | null> {
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

  // 2. Inventory: drug_batches.sellingprice (join via drugs.name / genericname)
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

  // 3. POS sales: pos_sale_items.unitprice (exact-name match first, then partial)
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

  // 4. Pharmacy orders: pharmacy_order_items.unitprice via drugname
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

  // 5. Invoice lines: pharmacy_invoice_lines.unitprice via description
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

  // 6. Admin fallback: medications_catalog
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
