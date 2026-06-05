import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getPatientById } from '@/lib/epr';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const patient = await getPatientById(session.patientId);
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  const safePatient = {
    patientId: patient.patientId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    address: patient.address,
    bloodType: patient.bloodType,
    allergies: patient.allergies,
  };

  return NextResponse.json(safePatient);
}
