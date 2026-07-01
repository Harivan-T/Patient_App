import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth';
import { query } from '@/lib/db';

// Verify item belongs to THIS patient's open cart
async function ownedItem(itemId: number, patientId: string): Promise<boolean> {
  const r = await query(
    `SELECT ci.id FROM cart_items ci
     JOIN carts c ON c.id = ci.cart_id
     WHERE ci.id = $1 AND c.patient_id = $2 AND c.status = 'open'`,
    [itemId, patientId],
  );
  return r.rows.length > 0;
}

// PATCH /api/cart/[itemId] — set quantity
export async function PATCH(
  req: NextRequest,
  { params }: { params: { itemId: string } },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const itemId = parseInt(params.itemId);
  if (isNaN(itemId)) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const parsed = z.object({ quantity: z.number().int().positive() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  if (!(await ownedItem(itemId, session.patientId)))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await query(`UPDATE cart_items SET quantity = $1 WHERE id = $2`, [parsed.data.quantity, itemId]);
  return NextResponse.json({ ok: true });
}

// DELETE /api/cart/[itemId] — remove ONE medication line (not the whole group)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { itemId: string } },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const itemId = parseInt(params.itemId);
  if (isNaN(itemId)) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  if (!(await ownedItem(itemId, session.patientId)))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await query(`DELETE FROM cart_items WHERE id = $1`, [itemId]);
  return NextResponse.json({ ok: true });
}
