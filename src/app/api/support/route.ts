import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/epr';

async function ensureTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS support_requests (
       id         BIGSERIAL    PRIMARY KEY,
       name       TEXT         NOT NULL,
       contact    TEXT         NOT NULL,
       problem    TEXT         NOT NULL,
       created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
     )`,
  );
}

export async function POST(req: NextRequest) {
  await ensureTable();
  const body = await req.json().catch(() => null);
  const name    = (body?.name    ?? '').trim();
  const contact = (body?.contact ?? '').trim();
  const problem = (body?.problem ?? '').trim();

  if (!name || !contact || !problem) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
  }

  await query(
    `INSERT INTO support_requests (name, contact, problem) VALUES ($1, $2, $3)`,
    [name, contact, problem],
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
