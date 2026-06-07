import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getPatientById } from '@/lib/epr';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json(null, { status: 401 });

  const patient = await getPatientById(session.patientId);
  if (!patient) return NextResponse.json(null, { status: 404 });

  return NextResponse.json({
    firstName: patient.firstName,
    lastName: patient.lastName,
    nationalId: patient.patientId,
  });
}
