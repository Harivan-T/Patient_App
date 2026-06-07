import type { Diagnosis, Vital, MedicalHistory, CarePlan, Medication, LabResultPanel, LabAnalyte } from '@/types';

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

  const res = await fetch(`${EHRBASE_URL}/ehrbase/rest/openehr/v1/query/aql`, {
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
      `${EHRBASE_URL}/ehrbase/rest/openehr/v1/ehr?subject_id=${encodeURIComponent(subjectId)}&subject_namespace=local`,
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
        c/uid/value                                                                    AS id,
        eval/data[at0001]/items[at0002]/value/value                                   AS name,
        eval/data[at0001]/items[at0002]/value/defining_code/code_string               AS code,
        eval/data[at0001]/items[at0009]/value/value                                   AS description,
        eval/data[at0001]/items[at0003]/value/value                                   AS date_onset,
        eval/data[at0001]/items[at0012]/value/value                                   AS body_site,
        eval/data[at0001]/items[at0030]/value/defining_code/code_string               AS status_code,
        c/context/start_time/value                                                    AS recorded_at,
        c/composer/name                                                                AS doctor
      FROM EHR e
        CONTAINS COMPOSITION c
        CONTAINS EVALUATION eval[openEHR-EHR-EVALUATION.problem_diagnosis.v1]
      WHERE e/ehr_id/value = $ehrId
      ORDER BY c/context/start_time/value DESC
    `, { ehrId });

    return (rows as unknown[][]).map((row, i) => ({
      id:          String(row[0] ?? i),
      name:        String(row[1] ?? 'Unknown'),
      code:        row[2] ? String(row[2]) : '',
      description: row[3] ? String(row[3]) : '',
      date:        String(row[4] ?? row[7] ?? ''),
      bodySite:    row[5] ? String(row[5]) : '',
      status:      mapStatus(String(row[6] ?? '')),
      recordedAt:  row[7] ? String(row[7]) : '',
      doctor:      row[8] ? String(row[8]) : '',
    }));
  } catch (e) {
    console.error('[EHRbase] getDiagnoses failed:', e);
    return [];
  }
}

// ── Vitals ────────────────────────────────────────────────────────────────────

export async function getVitals(ehrId: string): Promise<Vital[]> {
  try {
    // Fetch all vital sign items — each row is one ELEMENT (one measurement)
    const rows = await runAQL(`
      SELECT
        obs/data[at0001]/events[at0002]/data[at0003]/items AS item,
        c/context/start_time/value                          AS date
      FROM EHR e
        CONTAINS COMPOSITION c
        CONTAINS OBSERVATION obs[openEHR-EHR-OBSERVATION.vital_signs.v1]
      WHERE e/ehr_id/value = $ehrId
      ORDER BY c/context/start_time/value DESC
      LIMIT 30
    `, { ehrId });

    if (rows.length === 0) return [];

    // Only use the most recent recording session (same timestamp)
    const mostRecentDate = (rows[0] as unknown[])[1] as string;
    const recent = (rows as unknown[][]).filter((r) => r[1] === mostRecentDate);

    // Parse each ELEMENT item
    type ItemEl = { name?: { value?: string }; value?: { magnitude?: number; units?: string } };
    const parsed = recent.map((r) => {
      const el = r[0] as ItemEl;
      return {
        name:  el?.name?.value ?? '',
        mag:   el?.value?.magnitude ?? null,
        unit:  el?.value?.units ?? '',
        date:  String(r[1] ?? ''),
      };
    });

    // Find systolic + diastolic to combine into Blood Pressure
    const sys = parsed.find((p) => p.name.toLowerCase().includes('systolic'));
    const dia = parsed.find((p) => p.name.toLowerCase().includes('diastolic'));

    const vitals: Vital[] = [];

    if (sys && dia && sys.mag !== null && dia.mag !== null) {
      vitals.push({
        type: 'Blood Pressure',
        value: `${sys.mag}/${dia.mag}`,
        unit: 'mmHg',
        date: sys.date,
        normalRange: '90/60 – 120/80',
      });
    }

    // All other vitals by name keyword
    const VITAL_MAP: Array<{ keyword: string; label: string; normalRange?: string }> = [
      { keyword: 'heart rate',   label: 'Heart Rate',        normalRange: '60 – 100 bpm' },
      { keyword: 'pulse',        label: 'Heart Rate',        normalRange: '60 – 100 bpm' },
      { keyword: 'temperature',  label: 'Body Temperature',  normalRange: '36.1 – 37.2' },
      { keyword: 'spo2',         label: 'SpO2',              normalRange: '95 – 100%' },
      { keyword: 'oxygen',       label: 'SpO2',              normalRange: '95 – 100%' },
      { keyword: 'respiratory',  label: 'Respiratory Rate',  normalRange: '12 – 20 /min' },
      { keyword: 'respiration',  label: 'Respiratory Rate',  normalRange: '12 – 20 /min' },
      { keyword: 'weight',       label: 'Body Weight' },
      { keyword: 'height',       label: 'Height' },
    ];

    for (const p of parsed) {
      if (!p.name || p.mag === null) continue;
      const lower = p.name.toLowerCase();
      if (lower.includes('systolic') || lower.includes('diastolic')) continue; // already handled

      const match = VITAL_MAP.find((m) => lower.includes(m.keyword));
      if (match && !vitals.find((v) => v.type === match.label)) {
        vitals.push({
          type: match.label,
          value: Number(p.mag),
          unit: p.unit,
          date: p.date,
          normalRange: match.normalRange,
        });
      }
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
// Composition: openEHR-EHR-COMPOSITION.care_plan.v0 (template_care_plan_v1)
// Fields live in goal.v1 EVALUATION; schedule in service_request.v1 INSTRUCTION

export async function getCarePlan(ehrId: string): Promise<CarePlan | null> {
  try {
    const goalRows = await runAQL(`
      SELECT
        c/uid/value                                       AS id,
        goal/data[at0001]/items[at0002]/value/value       AS title,
        goal/data[at0001]/items[at0012]/value/value       AS description,
        goal/data[at0001]/items[at0010]/value/value       AS reason,
        goal/data[at0001]/items[at0004]/value/value       AS end_date,
        goal/data[at0001]/items[at0022]/value/value       AS comment,
        c/context/start_time/value                        AS start_date,
        c/context/end_time/value                          AS expire_date,
        c/composer/name                                   AS doctor
      FROM EHR e
        CONTAINS COMPOSITION c[openEHR-EHR-COMPOSITION.care_plan.v0]
        CONTAINS EVALUATION goal[openEHR-EHR-EVALUATION.goal.v1]
      WHERE e/ehr_id/value = $ehrId
      ORDER BY c/context/start_time/value DESC
      LIMIT 1
    `, { ehrId });

    if (goalRows.length === 0) return null;
    const r = goalRows[0] as unknown[];

    // Schedule lives in the service_request description field
    const schedRows = await runAQL(`
      SELECT inst/activities[at0001]/description[at0002]/items[at0011]/value/value AS schedule
      FROM EHR e
        CONTAINS COMPOSITION c[openEHR-EHR-COMPOSITION.care_plan.v0]
        CONTAINS INSTRUCTION inst[openEHR-EHR-INSTRUCTION.service_request.v1]
      WHERE e/ehr_id/value = $ehrId
      LIMIT 1
    `, { ehrId });

    const schedule = schedRows.length > 0
      ? String((schedRows[0] as unknown[])[0] ?? '')
      : '';

    return {
      id:          String(r[0] ?? ''),
      title:       String(r[1] ?? 'Care Plan'),
      description: String(r[2] ?? ''),
      reason:      r[3] ? String(r[3]) : undefined,
      endDate:     r[4] ? String(r[4]) : (r[7] ? String(r[7]) : undefined),
      comment:     r[5] ? String(r[5]) : undefined,
      startDate:   String(r[6] ?? ''),
      schedule:    schedule || undefined,
      doctor:      r[8] ? String(r[8]) : undefined,
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

// ── Lab orders (service requests) ────────────────────────────────────────────

export async function getLabOrdersFromEHR(ehrId: string) {
  try {
    const rows = await runAQL(`
      SELECT
        c/uid/value                                                                    AS id,
        inst/activities[at0001]/description[at0002]/items[at0003]/value/value         AS service_name,
        inst/activities[at0001]/description[at0002]/items[at0011]/value/value         AS description,
        inst/activities[at0001]/description[at0002]/items[at0012]/value/value         AS indication,
        inst/activities[at0001]/description[at0002]/items[at0017]/value/value         AS requested_date,
        inst/activities[at0001]/description[at0002]/items[at0018]/value/value         AS requesting_provider,
        inst/activities[at0001]/description[at0002]/items[at0019]/value/value         AS receiving_provider,
        inst/narrative/value                                                           AS narrative,
        c/context/start_time/value                                                    AS date,
        c/composer/name                                                                AS ordered_by
      FROM EHR e
        CONTAINS COMPOSITION c
        CONTAINS INSTRUCTION inst[openEHR-EHR-INSTRUCTION.service_request.v1]
      WHERE e/ehr_id/value = $ehrId
      ORDER BY c/context/start_time/value DESC
    `, { ehrId });

    return (rows as unknown[][]).map((r, i) => {
      const description  = String(r[2] ?? '');
      const narrative    = String(r[7] ?? '');
      const serviceName  = String(r[1] ?? 'Service Request');
      const date         = String(r[4] ?? r[8] ?? '');
      const doctor       = String(r[5] ?? r[9] ?? '');
      const labName      = String(r[6] ?? '');
      const indication   = String(r[3] ?? '');

      // Parse status from description text
      const statusMatch = description.match(/Status:\s*([^|]+)/i);
      const urgencyMatch = (description + narrative).match(/Urgency:\s*([^|]+)/i);
      const rawStatus = statusMatch?.[1]?.trim().toLowerCase() ?? 'pending';
      const status = rawStatus.includes('complet') ? 'completed'
                   : rawStatus.includes('cancel')  ? 'cancelled'
                   : 'pending';

      // Parse individual tests from "Selected Tests (N): test1, test2, ..."
      const testsMatch = description.match(/Selected Tests[^:]*:\s*([^|]+)/i);
      const testNames: string[] = testsMatch
        ? testsMatch[1].split(',').map((t) => t.trim()).filter(Boolean)
        : [serviceName];

      const urgency = urgencyMatch?.[1]?.trim() ?? '';

      return {
        id:          String(r[0] ?? i),
        orderDate:   date,
        doctorName:  doctor,
        hospitalName: labName || serviceName,
        status,
        indication,
        urgency,
        tests: testNames.map((name, j) => ({
          id:          `${r[0]}-${j}`,
          name,
          result:      '',
          unit:        '',
          normalRange: '',
          isAbnormal:  false,
          status:      'pending' as const,
          date,
        })),
      };
    });
  } catch (e) {
    console.error('[EHRbase] getLabOrdersFromEHR failed:', e);
    return [];
  }
}

// ── Lab results ───────────────────────────────────────────────────────────────
// Standard archetype: openEHR-EHR-OBSERVATION.laboratory_test_result.v1
// CLUSTER without at-code constraint to handle histopathology and custom templates.
// Analyte name from items[at0001] (DV_TEXT field), fallback to cluster runtime name.

export async function getLabResults(ehrId: string): Promise<LabResultPanel[]> {
  try {
    // Query per-analyte rows — one row per analyte cluster per result composition.
    // items[at0001] = analyte name (DV_TEXT); items[at0024] = result (DV_QUANTITY or DV_TEXT)
    const rows = await runAQL(`
      SELECT
        c/uid/value                                                          AS comp_id,
        obs/name/value                                                       AS panel_name,
        analyte/items[at0001]/value/value                                    AS analyte_name,
        analyte/name/value                                                   AS cluster_node_name,
        analyte/items[at0024]/value/magnitude                                AS value_num,
        analyte/items[at0024]/value/units                                    AS units,
        analyte/items[at0024]/value/value                                    AS value_text,
        analyte/items[at0004]/value/value                                    AS ref_range,
        analyte/items[at0028]/value/defining_code/code_string                AS flag,
        c/context/start_time/value                                           AS date,
        c/composer/name                                                      AS reported_by
      FROM EHR e
        CONTAINS COMPOSITION c
        CONTAINS OBSERVATION obs[openEHR-EHR-OBSERVATION.laboratory_test_result.v1]
        CONTAINS CLUSTER analyte
      WHERE e/ehr_id/value = $ehrId
      ORDER BY c/context/start_time/value DESC
      LIMIT 200
    `, { ehrId });

    // Group rows by composition UID → one LabResultPanel per composition
    const panels = new Map<string, LabResultPanel>();

    for (const raw of rows as unknown[][]) {
      const compId         = String(raw[0] ?? '');
      const panelName      = String(raw[1] ?? 'Lab Result');
      // Prefer the DV_TEXT analyte name field; fall back to the cluster's runtime name
      const analyteName    = String(raw[2] || raw[3] || '');
      const valueNum       = raw[4] != null ? Number(raw[4]) : undefined;
      const units          = raw[5] ? String(raw[5]) : undefined;
      const valueText      = raw[6] ? String(raw[6]) : undefined;
      const refRange       = raw[7] ? String(raw[7]) : undefined;
      const flag           = raw[8] ? String(raw[8]) : undefined;
      const date           = String(raw[9] ?? '');
      const reportedBy     = raw[10] ? String(raw[10]) : undefined;

      // Prefer numeric value; fall back to text (handles DV_TEXT results like "Negative")
      const value: string | number | undefined = valueNum !== undefined ? valueNum : valueText;

      const upperFlag = (flag ?? '').toUpperCase();
      const isAbnormal = upperFlag === 'H' || upperFlag === 'L' || upperFlag === 'C'
        || upperFlag.includes('HIGH') || upperFlag.includes('LOW') || upperFlag.includes('CRIT')
        || upperFlag === 'A' || upperFlag === 'AA';

      const analyte: LabAnalyte = { name: analyteName, value, units, referenceRange: refRange, flag, isAbnormal };

      if (!panels.has(compId)) {
        panels.set(compId, { id: compId, panelName, date, reportedBy, analytes: [] });
      }
      panels.get(compId)!.analytes.push(analyte);
    }

    return Array.from(panels.values());
  } catch (e) {
    console.error('[EHRbase] getLabResults failed:', e);
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
