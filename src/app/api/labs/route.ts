import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getPatientById, getLabOrders } from '@/lib/epr';
import { getEhrIdForPatient, getLabResults, getLabOrdersFromEHR } from '@/lib/ehrbase';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const patient = await getPatientById(session.patientId);
  const patientUuid = patient?.id ?? null;

  const [ehrByNational, ehrByUuid] = await Promise.all([
    getEhrIdForPatient(session.patientId),
    patientUuid ? getEhrIdForPatient(patientUuid) : Promise.resolve(null),
  ]);
  const ehrId = ehrByNational ?? ehrByUuid ?? patient?.ehrId ?? null;
  console.log('[labs/route] ehrId:', ehrId);

  const [limsOrdersResult, ehrOrdersResult, resultsResult] = await Promise.allSettled([
    getLabOrders(session.patientId, ehrId ?? undefined),
    ehrId ? getLabOrdersFromEHR(ehrId) : Promise.resolve([]),
    ehrId ? getLabResults(ehrId) : Promise.resolve([]),
  ]);

  const limsOrders = limsOrdersResult.status  === 'fulfilled' ? limsOrdersResult.value  : [];
  const ehrOrders  = ehrOrdersResult.status   === 'fulfilled' ? ehrOrdersResult.value   : [];
  const results    = resultsResult.status     === 'fulfilled' ? resultsResult.value     : [];

  if (limsOrdersResult.status === 'rejected')
    console.error('[labs/route] getLabOrders failed:', limsOrdersResult.reason);
  if (ehrOrdersResult.status === 'rejected')
    console.error('[labs/route] getLabOrdersFromEHR failed:', ehrOrdersResult.reason);

  // Merge: EHR orders first (most current), then LIMS standalone samples
  const orders = [...ehrOrders, ...limsOrders];

  return NextResponse.json({ orders, results });
}
