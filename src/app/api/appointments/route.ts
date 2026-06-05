import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getAppointments } from '@/lib/epr';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appointments = await getAppointments(session.patientId);
  const now = new Date().toISOString().split('T')[0];

  const upcoming = appointments.filter(
    (a) => a.date >= now && a.status !== 'cancelled'
  );
  const past = appointments.filter(
    (a) => a.date < now || a.status === 'past'
  );

  return NextResponse.json({ upcoming, past });
}
