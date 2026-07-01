import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { query } from '@/lib/db';

// POST /api/cart/submit
// Snapshots the open cart into orders + order_items, marks cart submitted,
// opens a fresh empty cart for the patient.
export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Load open cart — re-check patient ownership here (security guard)
  const cart = await query<{
    cart_id: number; item_id: number; medication_id: string;
    name_snapshot: string; quantity: number; group_name: string | null;
  }>(
    `SELECT c.id AS cart_id,
            ci.id AS item_id,
            ci.medication_id,
            ci.name_snapshot,
            ci.quantity,
            ci.group_name
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

  // Create order record
  const order = await query<{ id: number }>(
    `INSERT INTO orders (patient_id) VALUES ($1) RETURNING id`,
    [session.patientId],
  );
  const orderId = order.rows[0].id;

  // Snapshot each item
  for (const item of cart.rows) {
    await query(
      `INSERT INTO order_items (order_id, medication_id, name_snapshot, quantity, group_name_snapshot)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, item.medication_id, item.name_snapshot, item.quantity, item.group_name],
    );
  }

  // Close old cart; immediately open a fresh empty one
  await query(`UPDATE carts SET status = 'submitted' WHERE id = $1`, [cartId]);
  await query(`INSERT INTO carts (patient_id) VALUES ($1)`, [session.patientId]);

  return NextResponse.json({ ok: true, orderId, itemCount: cart.rows.length });
}
