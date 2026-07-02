import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth';
import { query } from '@/lib/db';

const patchSchema = z.object({
  name:        z.string().min(1).optional(),
  form:        z.string().nullable().optional(),
  strength:    z.string().nullable().optional(),
  price:       z.number().positive().optional(),
  description: z.string().nullable().optional(),
  available:   z.boolean().optional(),
});

// PUT /api/admin/drug-prices/[id] — update specific fields
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { name, form, strength, price, description, available } = parsed.data;

  const result = await query<{ id: number }>(
    `UPDATE medications_catalog
     SET name        = COALESCE($2, name),
         form        = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE form END,
         strength    = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE strength END,
         price       = COALESCE($5, price),
         description = CASE WHEN $6::text IS NOT NULL THEN $6 ELSE description END,
         available   = COALESCE($7, available)
     WHERE id = $1
     RETURNING id`,
    [id, name ?? null, form ?? null, strength ?? null, price ?? null, description ?? null, available ?? null],
  );

  if (!result.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/drug-prices/[id] — hard delete (prices are admin-managed data, not EHR)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const result = await query<{ id: number }>(
    `DELETE FROM medications_catalog WHERE id = $1 RETURNING id`,
    [id],
  );

  if (!result.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
