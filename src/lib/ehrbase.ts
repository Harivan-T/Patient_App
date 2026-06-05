import type { Diagnosis, Vital, MedicalHistory, CarePlan, Medication } from '@/types';

const EHRBASE_URL      = process.env.EHRBASE_URL!;
const EHRBASE_USER     = process.env.EHRBASE_USER!;
const EHRBASE_PASSWORD = process.env.EHRBASE_PASSWORD!;
const EHRBASE_API_KEY  = process.env.EHRBASE_API_KEY;

function getAuthHeaders(): HeadersInit {
  const creds = Buffer.from(`${EHRBASE_USER}:${EHRBASE_PASSWORD}`).toString('base64');
  const headers: Record<string, string> = {
    'Authorization': `Basic ${creds}`,
    'Content-Type':  'application/json',
    'Accept':        'application/json',
  };
  // Send API key as an additional header — do NOT replace Basic auth with it
  if (EHRBASE_API_KEY) {
    headers['EHRbase-API-Key'] = EHRBASE_API_KEY;
    headers['X-Api-Key']       = EHRBASE_API_KEY;
  }
  return headers;
}

async function runAQL(query: string, params?: Record<string, unknown>): Promise<unknown[]> {
  const body: Record<string, unknown> = { q: query };
  if (params) body['query_parameters'] = params;

  const res = await fetch(`${EHRBASE_URL}/rest/openehr/v1/query/aql`, {
    method:  'POST',
    headers: getAuthHeaders(),
    body:    JSON.stringify(body),
    cache:   'no-store',
    signal:  AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EHRbase AQL (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.rows ?? [];
}

export async function getEhrIdForPatient(subjectId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${EHRBASE_URL}/rest/openehr/v1/ehr?subject_id=${encodeURIComponent(subjectId)}&subject_namespace=local`,
      { headers: getAuthHeaders(), cache: 'no-store', signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.ehr_id?.value ?? null;
  } catch (e) {
    console.error('[EHRbase] getEhrIdForPatient failed:', e);
    return null;
  }
}

// ── Diagnoses ─────────────────────────────────────────────────────────────────
// Template: template_clinical_encounter_v1/v2 (openEHR-EHR-COMPOSITION.encounter.v1)

export async function getDiagnoses(ehrId: string): Promise<Diagnosis[]> {
  try {
    const rows = await runAQL(`
      SELECT
        c/uid/value                                                              AS composition_id,
        eval/data[at0001]/items[at0002]/value/defining_code/code_string         AS code,
        eval/data[at0001]/items[at0002]/value/value                             AS name,
        eval/data[at0001]/items[at0003]/value/value                             AS date_added,
        eval/data[at0001]/items[at0005]/value/defining_code/code_string         AS status
      FROM EHR e
        CONTAINS COMPOSITION c
        CONTAINS EVALUATION eval[openEHR-EHR-EVALUATION.problem_diagnosis.v1]
      WHERE e/ehr_id/value = $ehrId
      ORDER BY eval/data[at0001]/items[at0003]/value/value DESC
    `, { ehrId });

    return (rows as unknown[][]).map((row, i) => ({
      id:     String(row[0] ?? i),
      code:   String(row[1] ?? ''),
      name:   String(row[2] ?? 'Unknown'),
      date:   String(row[3] ?? ''),
      status: mapStatus(String(row[4] ?? '')),
    }));
  } catch (e) {
    console.error('[EHRbase] getDiagnoses failed:', e);
    return [];
  }
}

// ── Vitals ────────────────────────────────────────────────────────────────────

export async function getVitals(ehrId: string): Promise<Vital[]> {
  try {
    const vitals: Vital[] = [];

    const bpRows = await runAQL(`
      SELECT
        obs/data[at0001]/origin/value                                            AS date,
        obs/data[at0001]/events[at0006]/data[at0003]/items[at0004]/value/magnitude AS systolic,
        obs/data[at0001]/events[at0006]/data[at0003]/items[at0005]/value/magnitude AS diastolic,
        obs/data[at0001]/events[at0006]/data[at0003]/items[at0004]/value/units   AS units
      FROM EHR e
        CONTAINS COMPOSITION c
        CONTAINS OBSERVATION obs[openEHR-EHR-OBSERVATION.blood_pressure.v2]
      WHERE e/ehr_id/value = $ehrId
      ORDER BY obs/data[at0001]/origin/value DESC LIMIT 1
    `, { ehrId });

    if (bpRows.length > 0) {
      const r = bpRows[0] as unknown[];
      vitals.push({
        type:        'Blood Pressure',
        value:       `${r[1]}/${r[2]}`,
        unit:        String(r[3] ?? 'mmHg'),
        date:        String(r[0] ?? ''),
        normalRange: '90/60 - 120/80',
      });
    }

    const weightRows = await runAQL(`
      SELECT
        obs/data[at0002]/origin/value                                            AS date,
        obs/data[at0002]/events[at0003]/data[at0001]/items[at0004]/value/magnitude AS weight,
        obs/data[at0002]/events[at0003]/data[at0001]/items[at0004]/value/units   AS units
      FROM EHR e
        CONTAINS COMPOSITION c
        CONTAINS OBSERVATION obs[openEHR-EHR-OBSERVATION.body_weight.v2]
      WHERE e/ehr_id/value = $ehrId
      ORDER BY obs/data[at0002]/origin/value DESC LIMIT 1
    `, { ehrId });

    if (weightRows.length > 0) {
      const r = weightRows[0] as unknown[];
      vitals.push({ type: 'Body Weight', value: Number(r[1]), unit: String(r[2] ?? 'kg'), date: String(r[0] ?? '') });
    }

    const tempRows = await runAQL(`
      SELECT
        obs/data[at0002]/origin/value                                            AS date,
        obs/data[at0002]/events[at0003]/data[at0001]/items[at0004]/value/magnitude AS temp,
        obs/data[at0002]/events[at0003]/data[at0001]/items[at0004]/value/units   AS units
      FROM EHR e
        CONTAINS COMPOSITION c
        CONTAINS OBSERVATION obs[openEHR-EHR-OBSERVATION.body_temperature.v2]
      WHERE e/ehr_id/value = $ehrId
      ORDER BY obs/data[at0002]/origin/value DESC LIMIT 1
    `, { ehrId });

    if (tempRows.length > 0) {
      const r = tempRows[0] as unknown[];
      vitals.push({ type: 'Body Temperature', value: Number(r[1]), unit: String(r[2] ?? '°C'), date: String(r[0] ?? ''), normalRange: '36.1 - 37.2' });
    }

    return vitals;
  } catch (e) {
    console.error('[EHRbase] getVitals failed:', e);
    return [];
  }
}

// ── Medical history ───────────────────────────────────────────────────────────

export async function getMedicalHistory(ehrId: string): Promise<MedicalHistory[]> {
  try {
    const rows = await runAQL(`
      SELECT
        c/uid/value                                          AS id,
        eval/data[at0001]/items[at0004]/value/value          AS event,
        eval/data[at0001]/items[at0008]/value/value          AS date,
        eval/data[at0001]/items[at0005]/value/value          AS details
      FROM EHR e
        CONTAINS COMPOSITION c
        CONTAINS EVALUATION eval[openEHR-EHR-EVALUATION.clinical_synopsis.v1]
      WHERE e/ehr_id/value = $ehrId
      ORDER BY eval/data[at0001]/items[at0008]/value/value DESC
    `, { ehrId });

    return (rows as unknown[][]).map((row, i) => ({
      id:      String(row[0] ?? i),
      event:   String(row[1] ?? ''),
      date:    String(row[2] ?? ''),
      details: row[3] ? String(row[3]) : undefined,
    }));
  } catch (e) {
    console.error('[EHRbase] getMedicalHistory failed:', e);
    return [];
  }
}

// ── Care plan ─────────────────────────────────────────────────────────────────
// Template: template_care_plan_v1 uses openEHR-EHR-COMPOSITION.care_plan.v0

export async function getCarePlan(ehrId: string): Promise<CarePlan | null> {
  try {
    const rows = await runAQL(`
      SELECT
        c/uid/value                                              AS id,
        inst/description[at0001]/items[at0002]/value/value       AS title,
        inst/description[at0001]/items[at0044]/value/value       AS description,
        c/context/start_time/value                               AS start_date,
        c/context/end_time/value                                 AS end_date
      FROM EHR e
        CONTAINS COMPOSITION c[openEHR-EHR-COMPOSITION.care_plan.v0]
        CONTAINS INSTRUCTION inst[openEHR-EHR-INSTRUCTION.care_plan.v0]
      WHERE e/ehr_id/value = $ehrId
      LIMIT 1
    `, { ehrId });

    if (rows.length === 0) return null;
    const r = rows[0] as unknown[];
    return {
      id:          String(r[0] ?? ''),
      title:       String(r[1] ?? 'Care Plan'),
      description: String(r[2] ?? ''),
      startDate:   String(r[3] ?? ''),
      endDate:     r[4] ? String(r[4]) : undefined,
      goals:       [],
    };
  } catch (e) {
    console.error('[EHRbase] getCarePlan failed:', e);
    return null;
  }
}

// ── Medications ───────────────────────────────────────────────────────────────
// Templates: template_medication_summary_v1, template_medication_dispense_v1.opt

export async function getMedicationsFromEHR(ehrId: string): Promise<Medication[]> {
  try {
    // Try medication summary first
    const rows = await runAQL(`
      SELECT
        c/uid/value                                                              AS id,
        eval/data[at0001]/items[at0002]/value/value                             AS name,
        eval/data[at0001]/items[at0003]/value/value                             AS generic_name,
        eval/data[at0001]/items[at0004]/value/value                             AS dose,
        eval/data[at0001]/items[at0005]/value/value                             AS frequency,
        eval/data[at0001]/items[at0006]/value/value                             AS start_date,
        eval/data[at0001]/items[at0007]/value/value                             AS end_date,
        eval/data[at0001]/items[at0008]/value/value                             AS instructions,
        eval/data[at0001]/items[at0009]/value/defining_code/code_string         AS status
      FROM EHR e
        CONTAINS COMPOSITION c
        CONTAINS EVALUATION eval[openEHR-EHR-EVALUATION.medication_summary.v1]
      WHERE e/ehr_id/value = $ehrId
      ORDER BY eval/data[at0001]/items[at0006]/value/value DESC
    `, { ehrId });

    if (rows.length > 0) {
      return (rows as unknown[][]).map((r, i) => ({
        id:                String(r[0] ?? i),
        name:              String(r[1] ?? ''),
        genericName:       String(r[2] ?? ''),
        dosage:            String(r[3] ?? ''),
        frequency:         String(r[4] ?? ''),
        startDate:         String(r[5] ?? ''),
        endDate:           r[6] ? String(r[6]) : undefined,
        instructions:      String(r[7] ?? ''),
        prescribingDoctor: '',
        status:            mapMedStatus(String(r[8] ?? '')),
        refillable:        false,
      }));
    }

    // Fallback: try medication order instruction archetype
    const orderRows = await runAQL(`
      SELECT
        c/uid/value                                                                    AS id,
        inst/activities[at0001]/description[at0002]/items[at0070]/value/value          AS name,
        inst/activities[at0001]/description[at0002]/items[at0109]/value/value          AS dose,
        inst/activities[at0001]/description[at0002]/items[at0044]/value/value          AS frequency,
        inst/activities[at0001]/timing/value                                           AS start_date
      FROM EHR e
        CONTAINS COMPOSITION c
        CONTAINS INSTRUCTION inst[openEHR-EHR-INSTRUCTION.medication_order.v3]
      WHERE e/ehr_id/value = $ehrId
      ORDER BY c/context/start_time/value DESC
    `, { ehrId });

    return (orderRows as unknown[][]).map((r, i) => ({
      id:                String(r[0] ?? i),
      name:              String(r[1] ?? ''),
      genericName:       '',
      dosage:            String(r[2] ?? ''),
      frequency:         String(r[3] ?? ''),
      startDate:         String(r[4] ?? ''),
      endDate:           undefined,
      instructions:      '',
      prescribingDoctor: '',
      status:            'current' as const,
      refillable:        false,
    }));
  } catch (e) {
    console.error('[EHRbase] getMedicationsFromEHR failed:', e);
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapStatus(code: string): 'active' | 'resolved' | 'chronic' {
  const l = code.toLowerCase();
  if (l.includes('resolv') || l.includes('inactive')) return 'resolved';
  if (l.includes('chronic')) return 'chronic';
  return 'active';
}

function mapMedStatus(code: string): 'current' | 'past' {
  const l = code.toLowerCase();
  if (l.includes('stop') || l.includes('complet') || l.includes('past') || l.includes('cancel')) return 'past';
  return 'current';
}
