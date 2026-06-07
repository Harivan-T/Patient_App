import { Pool, PoolClient } from 'pg';
import type { Patient, Appointment, Medication, LabOrder, LabTest, BodyMapAnnotation, Diagnosis, MedicalHistory, LabResultPanel, LabAnalyte } from '@/types';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    // Strip channel_binding from URL — pg doesn't support it and it causes timeout on Neon
    const url = (process.env.DATABASE_URL ?? '').replace(/[&?]channel_binding=[^&]*/g, '');
    pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
  const client: PoolClient = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function patientIdExists(nationalId: string): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM patients WHERE nationalid = $1) AS exists`,
    [nationalId]
  );
  return rows[0]?.exists ?? false;
}

// patientId in app = nationalid in DB (Iraqi 12-digit national card number)
const PATIENT_SELECT = `
  SELECT p.patientid AS id,
         p.nationalid AS "patientId",
         p.firstname  AS "firstName",
         p.lastname   AS "lastName",
         p.dateofbirth AS "dateOfBirth",
         p.gender,
         p.phone AS "phoneNumber",
         p.address,
         p.bloodgroup AS "bloodType",
         COALESCE(
           pmi.allergies,
           p.medicalhistory->>'allergies',
           ''
         ) AS allergies,
         p.ehrid AS "ehrId"
  FROM patients p
  LEFT JOIN LATERAL (
    SELECT allergies FROM patient_medical_information
    WHERE patientid = p.patientid AND allergies IS NOT NULL
    LIMIT 1
  ) pmi ON true
`;

export async function getPatientByCredentials(
  nationalId: string,
  phone: string
): Promise<Patient | null> {
  const rows = await query<Patient>(
    `${PATIENT_SELECT} WHERE p.nationalid = $1 AND p.phone = $2 LIMIT 1`,
    [nationalId, phone]
  );
  return rows[0] ?? null;
}

export async function getPatientById(nationalId: string): Promise<Patient | null> {
  const rows = await query<Patient>(
    `${PATIENT_SELECT} WHERE p.nationalid = $1 LIMIT 1`,
    [nationalId]
  );
  return rows[0] ?? null;
}

export async function getAppointments(nationalId: string): Promise<Appointment[]> {
  return query<Appointment>(
    `SELECT a.appointmentid AS id,
            (a.starttime AT TIME ZONE 'UTC')::date::text                        AS date,
            (a.starttime AT TIME ZONE 'UTC')::time::text                        AS time,
            COALESCE(s.firstname || ' ' || s.lastname, '')                      AS "doctorName",
            COALESCE(s.specialty, '')                                            AS "hospitalName",
            COALESCE(a.unit, s.unit, '')                                        AS department,
            COALESCE(a.appointmenttype::text, '')                               AS type,
            a.status::text                                                      AS status,
            COALESCE(a.clinicalindication, a.reasonforrequest, a.description, '') AS notes
     FROM appointments a
     JOIN patients p ON p.patientid = a.patientid
     LEFT JOIN staff s ON s.staffid = COALESCE(a.doctorid, a.staff_id)
     WHERE p.nationalid = $1
     ORDER BY a.starttime DESC`,
    [nationalId]
  );
}

interface RawMedicalInfo {
  allergies:          string | null;
  chronicdiseases:    string | null;
  currentmedications: string | null;
  medicalhistory:     string | null;
  surgicalhistory:    string | null;
  familyhistory:      string | null;
}

export async function getPatientMedicalInfo(nationalId: string): Promise<RawMedicalInfo | null> {
  const rows = await query<RawMedicalInfo>(
    `SELECT pmi.allergies, pmi.chronicdiseases, pmi.currentmedications,
            pmi.medicalhistory, pmi.surgicalhistory, pmi.familyhistory
     FROM patient_medical_information pmi
     JOIN patients p ON p.patientid = pmi.patientid
     WHERE p.nationalid = $1
     ORDER BY
       (COALESCE(pmi.chronicdiseases,'') <> '')::int +
       (COALESCE(pmi.currentmedications,'') <> '')::int +
       (COALESCE(pmi.medicalhistory,'') <> '')::int +
       (COALESCE(pmi.allergies,'') <> '')::int DESC
     LIMIT 1`,
    [nationalId]
  );
  return rows[0] ?? null;
}

function splitText(text: string | null | undefined): string[] {
  if (!text) return [];
  return text.split(/[,،\n]+/).map(s => s.trim()).filter(Boolean);
}

export function parseDiagnoses(info: RawMedicalInfo | null): Diagnosis[] {
  const diseases = splitText(info?.chronicdiseases);
  return diseases.map((name, i) => ({
    id:     `db-diag-${i}`,
    code:   '',
    name,
    date:   '',
    status: 'chronic' as const,
  }));
}

export function parseMedications(info: RawMedicalInfo | null): Medication[] {
  return splitText(info?.currentmedications).map((name, i) => ({
    id:                `db-med-${i}`,
    name,
    genericName:       '',
    dosage:            '',
    frequency:         '',
    startDate:         '',
    endDate:           undefined,
    prescribingDoctor: '',
    status:            'current' as const,
    instructions:      '',
    refillable:        false,
  }));
}

export function parseMedicalHistory(info: RawMedicalInfo | null): MedicalHistory[] {
  const entries: MedicalHistory[] = [];
  const sections: Array<[keyof RawMedicalInfo, string]> = [
    ['medicalhistory',  'Medical History'],
    ['surgicalhistory', 'Surgical History'],
    ['familyhistory',   'Family History'],
  ];
  for (const [field, label] of sections) {
    splitText(info?.[field]).forEach((event, i) => {
      entries.push({ id: `db-${field}-${i}`, event, date: '', details: label });
    });
  }
  return entries;
}

export async function getMedications(nationalId: string): Promise<Medication[]> {
  try {
    return await getMedicationsFromPharmacy(nationalId);
  } catch {
    // Fallback to unstructured text field
    const info = await getPatientMedicalInfo(nationalId).catch(() => null);
    return parseMedications(info);
  }
}

function parseNotesField(notes: string | null): { instructions: string; endDate: string } {
  if (!notes) return { instructions: '', endDate: '' };
  const usage = notes.match(/[Uu]sage:\s*([^|]+)/)?.[1]?.trim() ?? '';
  const valid = notes.match(/[Vv]alid until:\s*([^|]+)/)?.[1]?.trim() ?? '';
  const instr = notes.match(/[Ii]nstructions:\s*([^|]+)/)?.[1]?.trim() ?? '';
  return {
    instructions: [usage ? `For ${usage}` : '', instr].filter(Boolean).join('. '),
    endDate: valid,
  };
}

export async function getMedicationsFromPharmacy(nationalId: string): Promise<Medication[]> {
  // One row per prescription ORDER (grouped), listing all drugs in that order
  const rows = await query<{
    id: string; name: string; dosage: string; genericName: string;
    prescribingDoctor: string; status: string; notes: string; startDate: string;
  }>(
    `SELECT
       po.orderid                                                    AS id,
       STRING_AGG(DISTINCT poi.drugname, ', ' ORDER BY poi.drugname) AS name,
       STRING_AGG(DISTINCT poi.dosage,   ' | ' ORDER BY poi.dosage)  AS dosage,
       STRING_AGG(
         CASE WHEN poi.dosage IS NOT NULL
              THEN poi.drugname || ' (' || poi.dosage || ')'
         END, chr(10) ORDER BY poi.drugname)                         AS "genericName",
       COALESCE(po.metadata->>'prescribed_by', '')                   AS "prescribingDoctor",
       po.status,
       COALESCE(po.notes, '')                                        AS notes,
       po.createdat::date::text                                      AS "startDate"
     FROM pharmacy_orders po
     JOIN patients p ON p.patientid = po.patientid
     LEFT JOIN pharmacy_order_items poi ON poi.orderid = po.orderid
     WHERE p.nationalid = $1
       AND (po.order_type IN ('DISPENSING','PRESCRIPTION') OR po.source = 'openehr')
     GROUP BY po.orderid, po.metadata, po.status, po.notes, po.createdat
     ORDER BY po.createdat DESC`,
    [nationalId]
  );

  return rows.map((r) => {
    const { instructions, endDate } = parseNotesField(r.notes);
    const isCurrent = ['PENDING','ACTIVE','DISPENSED'].includes((r.status ?? '').toUpperCase());
    return {
      id:                r.id,
      name:              r.name ?? 'Prescription Order',
      genericName:       r.genericName ?? '',
      dosage:            r.dosage ?? '',
      frequency:         '',
      startDate:         r.startDate ?? '',
      endDate:           endDate || undefined,
      prescribingDoctor: r.prescribingDoctor ?? '',
      status:            isCurrent ? 'current' as const : 'past' as const,
      instructions,
      refillable:        false,
    };
  });
}

export async function getLabOrders(nationalId: string): Promise<LabOrder[]> {
  const patient = await getPatientById(nationalId);
  if (!patient) return [];

  // accession_samples links patients via patientid (UUID as text) or subjectidentifier
  const patientUuid = patient.id ?? '';

  const samples = await query<Omit<LabOrder, 'tests'> & { sampleid: string }>(
    `SELECT
       sampleid::text                                        AS id,
       collectiondate                                        AS "orderDate",
       COALESCE(collectorname, '')                          AS "doctorName",
       COALESCE(sampletype, '')                             AS "hospitalName",
       COALESCE(currentstatus, 'pending')                   AS status
     FROM accession_samples
     WHERE patientid = $1
        OR subjectidentifier = $1
     ORDER BY collectiondate DESC`,
    [patientUuid]
  );

  if (samples.length === 0) return [];

  const sampleIds = samples.map((s) => s.id);

  const results = await query<LabTest & { order_id: string }>(
    `SELECT
       resultid::text                            AS id,
       sampleid::text                            AS order_id,
       testname                                  AS name,
       COALESCE(resultvalue, '')                 AS result,
       COALESCE(unit, '')                        AS unit,
       COALESCE(referencerange, '')              AS "normalRange",
       COALESCE(isabormal, false)                AS "isAbnormal",
       COALESCE(status, 'pending')               AS status,
       analyzeddate                              AS date
     FROM test_results
     WHERE sampleid = ANY($1::uuid[])
     ORDER BY createdat DESC`,
    [sampleIds]
  );

  return samples.map((sample) => ({
    ...sample,
    tests: results.filter((r) => r.order_id === sample.id),
  }));
}

export async function saveBodyMapAnnotation(
  annotation: Omit<BodyMapAnnotation, 'id' | 'createdAt'>
): Promise<BodyMapAnnotation> {
  const rows = await query<BodyMapAnnotation>(
    `INSERT INTO body_map_annotations
       (patient_id, area, side, x, y, severity, description, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id, patient_id AS "patientId", area, side, x, y, severity, description,
               created_at AS "createdAt"`,
    [annotation.patientId, annotation.area, annotation.side,
     annotation.x, annotation.y, annotation.severity, annotation.description]
  );
  return rows[0];
}

export async function getBodyMapAnnotations(patientId: string): Promise<BodyMapAnnotation[]> {
  return query<BodyMapAnnotation>(
    `SELECT id, patient_id AS "patientId", area, side, x, y, severity, description,
            created_at AS "createdAt"
     FROM body_map_annotations
     WHERE patient_id = $1
     ORDER BY created_at DESC`,
    [patientId]
  );
}

export async function deleteBodyMapAnnotations(patientId: string): Promise<void> {
  await query('DELETE FROM body_map_annotations WHERE patient_id = $1', [patientId]);
}

export async function sendRenewalToPharmacy(
  patientId: string,
  medicationId: string
): Promise<void> {
  await query(
    `INSERT INTO pharmacy_renewal_requests (patient_id, medication_id, requested_at, status)
     VALUES ($1, $2, NOW(), 'pending')
     ON CONFLICT (patient_id, medication_id)
     DO UPDATE SET requested_at = NOW(), status = 'pending'`,
    [patientId, medicationId]
  );
}

// ── Pain records ──────────────────────────────────────────────────────────────

interface PainRecordInput {
  zones:            string[];
  symptoms:         string[];
  painLevel:        number;
  duration:         string;
  movementPain:     boolean;
  nightPain:        boolean;
  takingMedication: boolean;
  hasFever:         boolean;
  notes:            string;
}

export async function savePainRecord(patientId: string, data: PainRecordInput) {
  // Auto-create table if it doesn't exist yet
  await query(`
    CREATE TABLE IF NOT EXISTS patient_pain_records (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id        VARCHAR     NOT NULL,
      zones             TEXT[]      NOT NULL DEFAULT '{}',
      symptoms          TEXT[]      NOT NULL DEFAULT '{}',
      pain_level        INTEGER     NOT NULL CHECK (pain_level BETWEEN 1 AND 10),
      duration          VARCHAR(50) NOT NULL DEFAULT '',
      movement_pain     BOOLEAN     NOT NULL DEFAULT false,
      night_pain        BOOLEAN     NOT NULL DEFAULT false,
      taking_medication BOOLEAN     NOT NULL DEFAULT false,
      has_fever         BOOLEAN     NOT NULL DEFAULT false,
      notes             TEXT        NOT NULL DEFAULT '',
      recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const rows = await query<{
    id: string; patient_id: string; zones: string[]; symptoms: string[];
    pain_level: number; duration: string; movement_pain: boolean; night_pain: boolean;
    taking_medication: boolean; has_fever: boolean; notes: string; recorded_at: string;
  }>(
    `INSERT INTO patient_pain_records
       (patient_id, zones, symptoms, pain_level, duration,
        movement_pain, night_pain, taking_medication, has_fever, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      patientId,
      data.zones,
      data.symptoms,
      data.painLevel,
      data.duration,
      data.movementPain,
      data.nightPain,
      data.takingMedication,
      data.hasFever,
      data.notes,
    ]
  );

  const r = rows[0];
  return {
    id:               r.id,
    zones:            r.zones,
    symptoms:         r.symptoms,
    painLevel:        r.pain_level,
    duration:         r.duration,
    movementPain:     r.movement_pain,
    nightPain:        r.night_pain,
    takingMedication: r.taking_medication,
    hasFever:         r.has_fever,
    notes:            r.notes,
    recordedAt:       r.recorded_at,
  };
}

export async function getPainHistory(patientId: string) {
  try {
    const rows = await query<{
      id: string; zones: string[]; symptoms: string[]; pain_level: number;
      duration: string; movement_pain: boolean; night_pain: boolean;
      taking_medication: boolean; has_fever: boolean; notes: string; recorded_at: string;
    }>(
      `SELECT id, zones, symptoms, pain_level, duration,
              movement_pain, night_pain, taking_medication, has_fever, notes, recorded_at
       FROM patient_pain_records
       WHERE patient_id = $1
       ORDER BY recorded_at DESC`,
      [patientId]
    );

    return rows.map((r) => ({
      id:               r.id,
      zones:            r.zones,
      symptoms:         r.symptoms,
      painLevel:        r.pain_level,
      duration:         r.duration,
      movementPain:     r.movement_pain,
      nightPain:        r.night_pain,
      takingMedication: r.taking_medication,
      hasFever:         r.has_fever,
      notes:            r.notes,
      recordedAt:       r.recorded_at,
    }));
  } catch {
    // Table doesn't exist yet — return empty until first record is saved
    return [];
  }
}

// ── Lab results from LIMS PostgreSQL tables ──────────────────────────────────
// Results are in accession_samples + test_results (FK was migrated from samples → accession_samples).
// Group by labcategory + collectiondate so related samples appear as one panel.
export async function getLabResultsFromDB(patientUuid: string): Promise<LabResultPanel[]> {
  try {
    const rows = await query<{
      sampleid: string;
      labcategory: string | null;
      sampletype: string;
      samplenumber: string;
      collectiondate: string;
      testname: string;
      resultvalue: string;
      unit: string | null;
      referencerange: string | null;
      referencemin: string | null;
      referencemax: string | null;
      flag: string | null;
      iscritical: boolean;
    }>(
      `SELECT
         s.sampleid,
         s.labcategory,
         s.sampletype,
         s.samplenumber,
         s.collectiondate::text,
         tr.testname,
         tr.resultvalue,
         tr.unit,
         tr.referencerange,
         tr.referencemin::text,
         tr.referencemax::text,
         tr.flag,
         tr.iscritical
       FROM accession_samples s
       JOIN test_results tr ON tr.sampleid = s.sampleid
                           OR tr.accessionsampleid = s.sampleid
       WHERE s.patientid = $1
       ORDER BY s.collectiondate DESC, tr.testname`,
      [patientUuid]
    );

    // Group by labcategory + date so one panel per category per day
    const panels = new Map<string, LabResultPanel>();

    for (const r of rows) {
      const dateDay = r.collectiondate.slice(0, 10);
      const panelKey = `${r.labcategory ?? 'Lab'}-${dateDay}`;

      const refRange = r.referencerange ??
        (r.referencemin && r.referencemax ? `${r.referencemin}–${r.referencemax}` : undefined);

      const flag = r.flag && r.flag !== 'normal' ? r.flag : undefined;
      const isAbnormal = r.iscritical || (!!r.flag && r.flag !== 'normal');

      const numericValue = parseFloat(r.resultvalue);
      const value: string | number = isNaN(numericValue) ? r.resultvalue : numericValue;

      const analyte: LabAnalyte = {
        name: r.testname,
        value,
        units: r.unit ?? undefined,
        referenceRange: refRange,
        flag,
        isAbnormal,
      };

      if (!panels.has(panelKey)) {
        panels.set(panelKey, {
          id: panelKey,
          panelName: r.labcategory || r.sampletype || 'Lab Result',
          date: r.collectiondate,
          analytes: [],
        });
      }
      panels.get(panelKey)!.analytes.push(analyte);
    }

    return Array.from(panels.values());
  } catch (e) {
    console.error('[DB] getLabResultsFromDB failed:', e);
    return [];
  }
}
