import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getLabOrders } from '@/lib/epr';
import { getEhrIdForPatient } from '@/lib/ehrbase';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Try to resolve live EHR ID so DB lims_orders query can match by it
  const liveEhrId = await getEhrIdForPatient(session.patientId);

  const orders = await getLabOrders(session.patientId, liveEhrId ?? undefined);
  return NextResponse.json({ orders });
}
