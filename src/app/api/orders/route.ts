import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { query } from '@/lib/db';

// GET /api/orders — list this patient's orders (newest first)
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await query<{
    order_id: number; created_at: string; status: string; total: string | null;
    item_id: number; name_snapshot: string; quantity: number; price_snapshot: string | null;
  }>(
    `SELECT o.id AS order_id, o.created_at, o.status, o.total,
            oi.id AS item_id, oi.name_snapshot, oi.quantity, oi.price_snapshot
     FROM med_orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.patient_id = $1
     ORDER BY o.created_at DESC, oi.id`,
    [session.patientId],
  );

  // Group rows by order
  const map = new Map<number, {
    id: number; createdAt: string; status: string; total: number | null;
    items: { id: number; name: string; quantity: number; price: number | null }[];
  }>();
  for (const row of result.rows) {
    if (!map.has(row.order_id)) {
      map.set(row.order_id, {
        id:        row.order_id,
        createdAt: row.created_at,
        status:    row.status,
        total:     row.total != null ? Number(row.total) : null,
        items:     [],
      });
    }
    if (row.item_id) {
      map.get(row.order_id)!.items.push({
        id:       row.item_id,
        name:     row.name_snapshot,
        quantity: row.quantity,
        price:    row.price_snapshot != null ? Number(row.price_snapshot) : null,
      });
    }
  }

  return NextResponse.json(Array.from(map.values()));
}

// POST /api/orders — convert open basket → pending order
export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const basket = await query<{
    basket_id: number; item_id: number; medication_id: number;
    name: string; quantity: number; price: string | null;
  }>(
    `SELECT b.id AS basket_id,
            bi.id AS item_id,
            bi.medication_id,
            mc.name,
            bi.quantity,
            mc.price
     FROM med_baskets b
     JOIN basket_items bi       ON bi.basket_id = b.id
     JOIN medications_catalog mc ON mc.id        = bi.medication_id
     WHERE b.patient_id = $1 AND b.status = 'open'
     ORDER BY bi.id`,
    [session.patientId],
  );

  if (!basket.rows.length) {
    return NextResponse.json({ error: 'Basket is empty' }, { status: 400 });
  }

  const basketId = basket.rows[0].basket_id;
  const items    = basket.rows;

  // Total only when every item has a price
  const allPriced = items.every((r) => r.price != null);
  const total = allPriced
    ? items.reduce((s, r) => s + Number(r.price) * Number(r.quantity), 0)
    : null;

  // Create the order
  const order = await query<{ id: number }>(
    `INSERT INTO med_orders (patient_id, total) VALUES ($1, $2) RETURNING id`,
    [session.patientId, total],
  );
  const orderId = order.rows[0].id;

  // Snapshot each item
  for (const item of items) {
    await query(
      `INSERT INTO order_items (order_id, medication_id, name_snapshot, quantity, price_snapshot)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, item.medication_id, item.name, item.quantity,
       item.price != null ? Number(item.price) : null],
    );
  }

  // Close basket + open a fresh empty one immediately
  await query(`UPDATE med_baskets SET status = 'submitted' WHERE id = $1`, [basketId]);
  await query(`INSERT INTO med_baskets (patient_id) VALUES ($1)`, [session.patientId]);

  return NextResponse.json({ ok: true, orderId, itemCount: items.length, total });
}
