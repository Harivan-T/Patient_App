import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth';
import { getMedications, sendRenewalToPharmacy } from '@/lib/epr';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const meds = await getMedications(session.patientId);

  return NextResponse.json({
    current: meds.filter((m) => m.status === 'current'),
    past:    meds.filter((m) => m.status === 'past'),
  });
}

const renewalSchema = z.object({ medicationId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = renewalSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  await sendRenewalToPharmacy(session.patientId, parsed.data.medicationId);
  return NextResponse.json({ success: true });
}
