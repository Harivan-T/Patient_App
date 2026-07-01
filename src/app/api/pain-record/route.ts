import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth';
import { savePainRecord, getPainHistory } from '@/lib/epr';

const schema = z.object({
  zones:             z.array(z.string()).min(1),
  symptoms:          z.array(z.string()).default([]),
  areaSymptoms:      z.record(z.string(), z.array(z.string())).default({}),
  painLevel:         z.number().int().min(1).max(10),
  duration:          z.string().default(''),
  movementPain:      z.boolean().default(false),
  nightPain:         z.boolean().default(false),
  takingMedication:  z.boolean().default(false),
  hasFever:          z.boolean().default(false),
  notes:             z.string().max(500).default(''),
});

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const record = await savePainRecord(session.patientId, parsed.data);
    return NextResponse.json({ record }, { status: 201 });
  } catch (e) {
    console.error('[pain-record POST]', e);
    return NextResponse.json({ error: 'Failed to save record' }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const records = await getPainHistory(session.patientId);
    return NextResponse.json({ records });
  } catch (e) {
    console.error('[pain-record GET]', e);
    return NextResponse.json({ records: [] });
  }
}
