import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getPatientById, getLabOrders, getLabResultsFromDB } from '@/lib/epr';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const patient = await getPatientById(session.patientId);
  const patientUuid = patient?.id ?? null;

  const [orders, results] = await Promise.all([
    getLabOrders(session.patientId),
    patientUuid ? getLabResultsFromDB(patientUuid) : Promise.resolve([]),
  ]);

  return NextResponse.json({ orders, results });
}
