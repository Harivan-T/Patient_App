import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { query } from '@/lib/db';

// GET /api/cart/history — all submitted orders for this patient, newest first
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await query<{
    order_id: number; created_at: string; status: string; total: string | null;
    item_id: number; medication_id: string; name_snapshot: string;
    quantity: number; group_name_snapshot: string | null; price_snapshot: string | null;
  }>(
    `SELECT o.id AS order_id, o.created_at, o.status, o.total,
            oi.id AS item_id, oi.medication_id, oi.name_snapshot,
            oi.quantity, oi.group_name_snapshot, oi.price_snapshot
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.patient_id = $1
     ORDER BY o.created_at DESC, oi.id ASC`,
    [session.patientId],
  );

  const map = new Map<number, {
    id: number; createdAt: string; status: string; total: number | null;
    items: { id: number; medicationId: string; name: string; quantity: number; groupName: string | null; price: number | null }[];
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
        id:          row.item_id,
        medicationId: row.medication_id,
        name:        row.name_snapshot,
        quantity:    row.quantity,
        groupName:   row.group_name_snapshot,
        price:       row.price_snapshot != null ? Number(row.price_snapshot) : null,
      });
    }
  }

  return NextResponse.json(Array.from(map.values()));
}
