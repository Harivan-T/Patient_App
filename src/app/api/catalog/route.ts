import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const [sql, params] = q
    ? [
        `SELECT id, name, form, strength, price, description, available
         FROM medications_catalog
         WHERE available = TRUE
           AND (name ILIKE $1 OR form ILIKE $1 OR strength ILIKE $1 OR description ILIKE $1)
         ORDER BY name`,
        [`%${q}%`],
      ]
    : [
        `SELECT id, name, form, strength, price, description, available
         FROM medications_catalog
         WHERE available = TRUE
         ORDER BY name`,
        [],
      ];

  const result = await query(sql, params);
  return NextResponse.json(result.rows);
}
