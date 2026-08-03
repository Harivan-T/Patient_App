import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { query } from '@/lib/db';
import { catalogPrice } from '@/lib/pricing';

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
