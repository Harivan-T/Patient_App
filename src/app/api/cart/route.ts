import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth';
import { query } from '@/lib/db';

// Ensure one open cart exists for this patient (never creates duplicates)
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

// GET /api/cart — open cart with all items, scoped to session patient
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await query<{
    cart_id: number; item_id: number; medication_id: string;
    name_snapshot: string; quantity: number; group_id: string | null; group_name: string | null;
  }>(
    `SELECT c.id AS cart_id,
            ci.id AS item_id,
            ci.medication_id,
            ci.name_snapshot,
            ci.quantity,
            ci.group_id,
            ci.group_name
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
  const items  = result.rows
    .filter((r) => r.item_id != null)
    .map((r) => ({
      itemId:       r.item_id,
      medicationId: r.medication_id,
      name:         r.name_snapshot,
      quantity:     r.quantity,
      groupId:      r.group_id,
      groupName:    r.group_name,
    }));

  return NextResponse.json({ cartId, items, totalItems: items.length });
}

// POST /api/cart — add one or more items
// Body: { items: Array<{ medicationId, name, groupId?, groupName? }> }
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
    await query(
      `INSERT INTO cart_items (cart_id, medication_id, name_snapshot, quantity, group_id, group_name)
       VALUES ($1, $2, $3, 1, $4, $5)
       ON CONFLICT (cart_id, medication_id)
       DO UPDATE SET quantity = cart_items.quantity + 1`,
      [cartId, item.medicationId, item.name, item.groupId ?? null, item.groupName ?? null],
    );
  }

  return NextResponse.json({ ok: true, added: parsed.data.items.length });
}
