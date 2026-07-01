import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth';
import { query } from '@/lib/db';

/* ── helpers ── */
async function getOrCreateBasket(patientId: string): Promise<number> {
  const ex = await query<{ id: number }>(
    `SELECT id FROM med_baskets WHERE patient_id = $1 AND status = 'open' LIMIT 1`,
    [patientId],
  );
  if (ex.rows.length) return ex.rows[0].id;
  const cr = await query<{ id: number }>(
    `INSERT INTO med_baskets (patient_id) VALUES ($1) RETURNING id`,
    [patientId],
  );
  return cr.rows[0].id;
}

async function upsertItem(basketId: number, medicationId: number, qty: number) {
  await query(
    `INSERT INTO basket_items (basket_id, medication_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (basket_id, medication_id)
     DO UPDATE SET quantity = basket_items.quantity + EXCLUDED.quantity`,
    [basketId, medicationId, qty],
  );
}

/* ── GET — open basket with items ── */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await query<{
    basket_id: number; item_id: number; medication_id: number;
    name: string; form: string; strength: string; price: string; quantity: number;
  }>(
    `SELECT b.id    AS basket_id,
            bi.id   AS item_id,
            bi.medication_id,
            mc.name, mc.form, mc.strength, mc.price,
            bi.quantity
     FROM med_baskets b
     LEFT JOIN basket_items bi       ON bi.basket_id  = b.id
     LEFT JOIN medications_catalog mc ON mc.id         = bi.medication_id
     WHERE b.patient_id = $1 AND b.status = 'open'
     ORDER BY bi.id`,
    [session.patientId],
  );

  if (!result.rows.length || result.rows[0].basket_id == null) {
    return NextResponse.json({ basketId: null, items: [], itemCount: 0, totalQty: 0 });
  }

  const basketId = result.rows[0].basket_id;
  const items = result.rows
    .filter((r) => r.item_id != null)
    .map((r) => ({
      itemId:       r.item_id,
      medicationId: r.medication_id,
      name:         r.name,
      form:         r.form,
      strength:     r.strength,
      price:        r.price != null ? Number(r.price) : null,
      quantity:     Number(r.quantity),
    }));

  return NextResponse.json({
    basketId,
    items,
    itemCount: items.length,
    totalQty:  items.reduce((s, i) => s + i.quantity, 0),
  });
}

/* ── POST — add item(s) to basket ──
   Body variants:
   { medicationId: number, quantity?: number }  — catalog item by ID
   { medName: string,      quantity?: number }  — prescribed med by name lookup
   { medNames: string[] }                       — "order all" (qty 1 each)
*/
const addSchema = z.object({
  medicationId: z.number().int().positive().optional(),
  medName:      z.string().min(1).optional(),
  medNames:     z.array(z.string().min(1)).optional(),
  quantity:     z.number().int().positive().default(1),
});

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = addSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { medicationId, medName, medNames, quantity } = parsed.data;

  if (!medicationId && !medName && !medNames) {
    return NextResponse.json({ error: 'medicationId, medName, or medNames required' }, { status: 400 });
  }

  const basketId = await getOrCreateBasket(session.patientId);

  // By catalog ID
  if (medicationId) {
    const med = await query<{ id: number }>(
      `SELECT id FROM medications_catalog WHERE id = $1 AND available = TRUE`,
      [medicationId],
    );
    if (!med.rows.length) return NextResponse.json({ error: 'notAvailable' }, { status: 404 });
    await upsertItem(basketId, medicationId, quantity);
    return NextResponse.json({ ok: true, added: 1 });
  }

  // By name (single) — prescribed-med "Order" button
  if (medName) {
    const med = await query<{ id: number }>(
      // Three-tier match:
      // 1. Containment: catalog name inside EPR name or vice versa
      // 2. First-word equality: "Metformin HCl 500mg" → "metformin" == "Metformin"
      // 3. EPR name starts with catalog first-word (handles "Metformin500" edge cases)
      `SELECT id FROM medications_catalog
       WHERE available = TRUE AND (
         $1 ILIKE '%' || name || '%'
         OR name ILIKE '%' || $1 || '%'
         OR LOWER(SPLIT_PART($1::TEXT, ' ', 1)) = LOWER(SPLIT_PART(name, ' ', 1))
       )
       ORDER BY
         CASE
           WHEN $1 ILIKE '%' || name || '%' OR name ILIKE '%' || $1 || '%' THEN 0
           ELSE 1
         END,
         length(name) DESC
       LIMIT 1`,
      [medName],
    );
    if (!med.rows.length) return NextResponse.json({ error: 'notInCatalog' }, { status: 404 });
    await upsertItem(basketId, med.rows[0].id, quantity);
    return NextResponse.json({ ok: true, added: 1 });
  }

  // By name array — "Order All" button
  if (medNames) {
    let added = 0;
    for (const name of medNames) {
      const med = await query<{ id: number }>(
        `SELECT id FROM medications_catalog
         WHERE available = TRUE AND (
           $1 ILIKE '%' || name || '%'
           OR name ILIKE '%' || $1 || '%'
           OR LOWER(SPLIT_PART($1::TEXT, ' ', 1)) = LOWER(SPLIT_PART(name, ' ', 1))
         )
         ORDER BY
           CASE
             WHEN $1 ILIKE '%' || name || '%' OR name ILIKE '%' || $1 || '%' THEN 0
             ELSE 1
           END,
           length(name) DESC
         LIMIT 1`,
        [name],
      );
      if (med.rows.length) { await upsertItem(basketId, med.rows[0].id, 1); added++; }
    }
    return NextResponse.json({ ok: true, added });
  }

  return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
}
