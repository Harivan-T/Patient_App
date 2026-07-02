import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth';
import { query } from '@/lib/db';

// GET /api/admin/drug-prices — all medications_catalog rows (including unavailable)
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await query(
    `SELECT id, name, form, strength, price, description, available
     FROM medications_catalog
     ORDER BY name`,
  );
  return NextResponse.json(result.rows);
}

const upsertSchema = z.object({
  name:        z.string().min(1),
  form:        z.string().optional(),
  strength:    z.string().optional(),
  price:       z.number().positive(),
  description: z.string().optional(),
  available:   z.boolean().optional(),
});

// POST /api/admin/drug-prices — insert or update (by exact name match) a catalog entry
export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = upsertSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { name, form, strength, price, description, available = true } = parsed.data;

  const result = await query<{ id: number }>(
    `INSERT INTO medications_catalog (name, form, strength, price, description, available)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (name) DO UPDATE
       SET form        = EXCLUDED.form,
           strength    = EXCLUDED.strength,
           price       = EXCLUDED.price,
           description = EXCLUDED.description,
           available   = EXCLUDED.available
     RETURNING id`,
    [name, form ?? null, strength ?? null, price, description ?? null, available],
  );
  return NextResponse.json({ ok: true, id: result.rows[0].id });
}
