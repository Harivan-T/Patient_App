import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth';
import { query } from '@/lib/db';

// Verify the item belongs to this patient's open basket
async function ownedItem(itemId: number, patientId: string): Promise<boolean> {
  const r = await query(
    `SELECT bi.id FROM basket_items bi
     JOIN med_baskets b ON b.id = bi.basket_id
     WHERE bi.id = $1 AND b.patient_id = $2 AND b.status = 'open'`,
    [itemId, patientId],
  );
  return r.rows.length > 0;
}

// PATCH /api/basket/[itemId] — update quantity
export async function PATCH(
  req: NextRequest,
  { params }: { params: { itemId: string } },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const itemId = parseInt(params.itemId);
  if (isNaN(itemId)) return NextResponse.json({ error: 'Invalid item' }, { status: 400 });

  const parsed = z.object({ quantity: z.number().int().positive() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  if (!(await ownedItem(itemId, session.patientId)))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await query(`UPDATE basket_items SET quantity = $1 WHERE id = $2`, [parsed.data.quantity, itemId]);
  return NextResponse.json({ ok: true });
}

// DELETE /api/basket/[itemId] — remove item
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { itemId: string } },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const itemId = parseInt(params.itemId);
  if (isNaN(itemId)) return NextResponse.json({ error: 'Invalid item' }, { status: 400 });

  if (!(await ownedItem(itemId, session.patientId)))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await query(`DELETE FROM basket_items WHERE id = $1`, [itemId]);
  return NextResponse.json({ ok: true });
}
