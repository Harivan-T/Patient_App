import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getPatientById, getPatientMedicalInfo, parseDiagnoses, parseMedicalHistory } from '@/lib/epr';
import { getDiagnoses, getVitals, getMedicalHistory, getCarePlan } from '@/lib/ehrbase';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const patient = await getPatientById(session.patientId);
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  // DB fallback (always works)
  const medInfo = await getPatientMedicalInfo(session.patientId).catch(() => null);
  let diagnoses  = parseDiagnoses(medInfo);
  let history    = parseMedicalHistory(medInfo);
  let vitals:    unknown[] = [];
  let carePlan:  unknown   = null;

  // EHRbase: use the ehrId stored in the DB (e.g. "40171d7e-e3e9-4230-9bca-32d82b249b3d")
  // Runs from the user's machine so EHRbase on the local network IS reachable
  const ehrId = patient.ehrId;
  if (ehrId) {
    const [ehrDiagnoses, ehrVitals, ehrHistory, ehrCarePlan] = await Promise.all([
      getDiagnoses(ehrId),
      getVitals(ehrId),
      getMedicalHistory(ehrId),
      getCarePlan(ehrId),
    ]);
    if (ehrDiagnoses.length > 0) diagnoses = ehrDiagnoses;
    if (ehrVitals.length    > 0) vitals    = ehrVitals;
    if (ehrHistory.length   > 0) history   = ehrHistory;
    if (ehrCarePlan)              carePlan  = ehrCarePlan;
  }

  return NextResponse.json({ diagnoses, vitals, history, carePlan });
}
