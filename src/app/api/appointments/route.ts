import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getAppointments, getPatientById } from '@/lib/epr';
import { getEncounterDoctors } from '@/lib/ehrbase';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appointments = await getAppointments(session.patientId);

  // Back-fill missing doctor names from EHRbase c/composer/name — the same
  // field the Diagnoses screen uses.  Wrapped in try/catch so any EHRbase
  // failure is silent and the appointments still return with EPR data.
  try {
    if (appointments.some((a) => !a.doctorName)) {
      const patient = await getPatientById(session.patientId);
      if (patient?.ehrId) {
        const encounterDoctors = await getEncounterDoctors(patient.ehrId);
        for (const appt of appointments) {
          if (!appt.doctorName && appt.date) {
            appt.doctorName = encounterDoctors.get(appt.date) ?? '';
          }
        }
      }
    }
  } catch {
    // EHRbase unavailable — serve appointments with EPR staff data only
  }

  const now = new Date().toISOString().split('T')[0];

  const upcoming = appointments.filter(
    (a) => a.date >= now && a.status !== 'cancelled'
  );
  const past = appointments.filter(
    (a) => a.date < now || a.status === 'past'
  );

  return NextResponse.json({ upcoming, past });
}
