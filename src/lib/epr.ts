import { Pool, PoolClient } from 'pg';
import type { Patient, Appointment, Medication, LabOrder, LabTest, BodyMapAnnotation, Diagnosis, MedicalHistory, LabResultPanel, LabAnalyte, DispensedMed } from '@/types';

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

export async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
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
    `SELECT a.appointmentid::text                                                           AS id,
            (a.starttime AT TIME ZONE 'UTC')::date::text                                  AS date,
            (a.starttime AT TIME ZONE 'UTC')::time::text                                  AS time,
            COALESCE(NULLIF(TRIM(COALESCE(s.firstname,'') || ' ' || COALESCE(s.lastname,'')), ''), '') AS "doctorName",
            COALESCE(s.specialty, a.unit, '')                                              AS "hospitalName",
            COALESCE(a.unit, s.unit, '')                                                   AS department,
            COALESCE(a.appointmenttype::text, '')                                          AS type,
            COALESCE(a.status::text, '')                                                   AS status,
            COALESCE(a.clinicalindication, a.reasonforrequest, a.description, '')          AS notes
     FROM appointments a
     JOIN patients p ON p.patientid = a.patientid
     LEFT JOIN staff s ON s.staffid = COALESCE(a.doctorid, a.staff_id)
     WHERE p.nationalid = $1
     ORDER BY a.starttime DESC
     LIMIT 100`,
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

function parseNotesField(notes: string | null): { instructions: string; endDate: string; usage: string } {
  if (!notes) return { instructions: '', endDate: '', usage: '' };
  const usage = notes.match(/[Uu]sage:\s*([^|]+)/)?.[1]?.trim() ?? '';
  const valid = notes.match(/[Vv]alid until:\s*([^|]+)/)?.[1]?.trim() ?? '';
  const instr = notes.match(/[Ii]nstructions:\s*([^|]+)/)?.[1]?.trim() ?? '';
  return {
    instructions: instr,
    endDate:      valid,
    usage,
  };
}

const ROUTE_KEYWORDS = new Set([
  'oral', 'intravenous', 'iv', 'im', 'sc', 'subcutaneous', 'intramuscular',
  'topical', 'sublingual', 'rectal', 'inhalation', 'nasal', 'implant', 'injection',
]);

function parseDosageField(raw: string | null): { dose: string; route: string; frequency: string } {
  if (!raw) return { dose: '', route: '', frequency: '' };
  // Deduplicate comma-separated parts (case-insensitive) while preserving first occurrence
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (!seen.has(key)) { seen.add(key); unique.push(p); }
  }
  const dose      = unique.find((p) => /^[\d.]+\s*(mg|ml|mcg|g\b|iu|unit)/i.test(p)) ?? '';
  const route     = unique.find((p) => ROUTE_KEYWORDS.has(p.toLowerCase())) ?? '';
  const frequency = unique.filter((p) => p !== dose && p !== route).join(', ');
  return { dose, route, frequency };
}

export async function getMedicationsFromPharmacy(nationalId: string): Promise<Medication[]> {
  // pharmacy_orders has one row per drug — group by (date + doctor) so all drugs
  // prescribed in the same visit appear as one card.
  const rows = await query<{
    prescriptionDate: string;
    prescribingDoctor: string;
    status: string;
    drugName: string | null;
    drugDosage: string | null;
    drugNotes: string;
  }>(
    `SELECT
       po.createdat::date::text                    AS "prescriptionDate",
       COALESCE(po.metadata->>'prescribed_by', '') AS "prescribingDoctor",
       po.status,
       poi.drugname                                AS "drugName",
       poi.dosage                                  AS "drugDosage",
       COALESCE(po.notes, '')                      AS "drugNotes"
     FROM pharmacy_orders po
     JOIN patients p ON p.patientid = po.patientid
     LEFT JOIN pharmacy_order_items poi ON poi.orderid = po.orderid
     WHERE p.nationalid = $1
       AND (po.order_type IN ('DISPENSING','PRESCRIPTION') OR po.source = 'openehr')
       AND po.status NOT IN ('DISPENSED', 'PARTIALLY_DISPENSED', 'CANCELLED')
     ORDER BY po.createdat DESC, poi.drugname
     LIMIT 200`,
    [nationalId]
  );

  // Group by date+doctor — one card per prescription visit
  const prescMap = new Map<string, {
    key: string; startDate: string; prescribingDoctor: string; status: string;
    drugs: { name: string; rawDosage: string; notes: string }[];
  }>();

  for (const row of rows) {
    const key = `${row.prescriptionDate}|${row.prescribingDoctor}`;
    if (!prescMap.has(key)) {
      prescMap.set(key, {
        key,
        startDate:         row.prescriptionDate ?? '',
        prescribingDoctor: row.prescribingDoctor ?? '',
        status:            row.status ?? '',
        drugs:             [],
      });
    }
    if (row.drugName) {
      const existing = prescMap.get(key)!.drugs;
      if (!existing.some((d) => d.name === row.drugName)) {
        existing.push({
          name:      row.drugName,
          rawDosage: row.drugDosage ?? '',
          notes:     row.drugNotes ?? '',
        });
      }
    }
  }

  return Array.from(prescMap.values()).map((presc) => {
    const isCurrent = ['PENDING', 'ACTIVE'].includes(presc.status.toUpperCase());
    const count = presc.drugs.length;

    const drugs = presc.drugs.map((d) => {
      const { dose, route, frequency } = parseDosageField(d.rawDosage);
      const { usage, endDate }         = parseNotesField(d.notes);
      return {
        name:      d.name,
        dosage:    dose    || undefined,
        route:     route   || undefined,
        frequency: frequency || undefined,
        usage:     usage   || undefined,
        endDate:   endDate || undefined,
      };
    });

    return {
      id:                presc.key,
      name:              count > 0
                           ? `Prescription — ${count} medication${count === 1 ? '' : 's'}`
                           : 'Prescription Order',
      genericName:       undefined,
      dosage:            '',
      frequency:         '',
      startDate:         presc.startDate,
      endDate:           undefined,
      prescribingDoctor: presc.prescribingDoctor,
      status:            isCurrent ? 'current' as const : 'past' as const,
      instructions:      undefined,
      refillable:        false,
      drugs,
    };
  });
}

export async function getLabOrders(nationalId: string, ehrId?: string): Promise<LabOrder[]> {
  try {
    return await _getLabOrders(nationalId, ehrId);
  } catch (err) {
    console.error('[getLabOrders] unexpected error:', err);
    return [];
  }
}

async function _getLabOrders(nationalId: string, ehrId?: string): Promise<LabOrder[]> {
  const patientRows = await query<{ id: string }>(
    `SELECT patientid::text AS id FROM patients WHERE nationalid = $1 LIMIT 1`,
    [nationalId],
  );
  if (!patientRows.length) return [];
  const patientUuid = patientRows[0].id;

  const knownIds = [patientUuid, nationalId, ...(ehrId ? [ehrId] : [])].filter(Boolean);

  // Discover any LIMS-internal subjectidentifier via accession_samples reverse-lookup,
  // also matching by ehrid column which lims_orders stores separately.
  const discoveredRows = await query<{ subjectidentifier: string }>(
    `SELECT DISTINCT lo.subjectidentifier
     FROM lims_orders lo
     JOIN accession_samples s ON s.orderid = lo.orderid
     WHERE s.patientid = ANY($1::text[])
        OR s.subjectidentifier = ANY($1::text[])
        OR s.ehrid = ANY($1::text[])`,
    [knownIds]
  ).catch(() => [] as { subjectidentifier: string }[]);

  const identifiers = Array.from(new Set([
    ...knownIds,
    ...discoveredRows.map((r) => r.subjectidentifier).filter(Boolean),
  ]));

  // ── Step 1: All lims_orders for this patient ─────────────────────────────
  // Match by subjectidentifier OR the ehrid column (LIMS stores EHRbase EHR ID there).
  const limsOrders = await query<{
    orderid: string;
    orderDate: string;
    doctorName: string;
    orderStatus: string;
    clinicalIndication: string;
  }>(
    `(SELECT DISTINCT
        lo.orderid::text                          AS orderid,
        lo.createdat                              AS "orderDate",
        COALESCE(lo.orderingprovidername, '')     AS "doctorName",
        COALESCE(lo.status, '')                   AS "orderStatus",
        COALESCE(lo.clinicalindication, '')       AS "clinicalIndication"
      FROM lims_orders lo
      WHERE lo.subjectidentifier = ANY($1::text[])
         OR lo.ehrid = ANY($1::text[]))
     UNION
     (SELECT DISTINCT
        lo.orderid::text                          AS orderid,
        lo.createdat                              AS "orderDate",
        COALESCE(lo.orderingprovidername, '')     AS "doctorName",
        COALESCE(lo.status, '')                   AS "orderStatus",
        COALESCE(lo.clinicalindication, '')       AS "clinicalIndication"
      FROM lims_orders lo
      JOIN accession_samples s ON s.orderid = lo.orderid
      WHERE s.patientid = ANY($1::text[])
         OR s.subjectidentifier = ANY($1::text[])
         OR s.ehrid = ANY($1::text[]))
     ORDER BY "orderDate" DESC`,
    [identifiers]
  );

  const limsOrderIds = limsOrders.map((o) => o.orderid);

  // ── Step 2: Tests from lims_order_tests (real test names + live status) ──
  const limsOrderTests = limsOrderIds.length > 0
    ? await query<{
        ordertestid: string;
        orderid: string;
        testname: string;
        testcode: string;
        teststatus: string;
        resultvalue: string | null;
        resultunit: string | null;
      }>(
        `SELECT
           ordertestid::text                             AS ordertestid,
           orderid::text                                 AS orderid,
           COALESCE(testname, testcode, 'Unknown Test')  AS testname,
           COALESCE(testcode, '')                        AS testcode,
           COALESCE(teststatus, 'REQUESTED')             AS teststatus,
           resultvalue,
           resultunit
         FROM lims_order_tests
         WHERE orderid = ANY($1::uuid[])
         ORDER BY createdat ASC`,
        [limsOrderIds]
      ).catch(() => [])
    : [];

  // ── Step 3: Samples linked to those orders ────────────────────────────────
  const samplesForOrders = limsOrderIds.length > 0
    ? await query<{
        sampleid: string;
        orderid: string;
        labcategory: string;
        sampletype: string;
        collectiondate: string;
      }>(
        `SELECT DISTINCT ON (sampleid)
           sampleid::text                    AS sampleid,
           orderid::text                     AS orderid,
           COALESCE(labcategory, '')         AS labcategory,
           COALESCE(sampletype, '')          AS sampletype,
           collectiondate::text              AS collectiondate
         FROM accession_samples
         WHERE orderid = ANY($1::uuid[])
         ORDER BY sampleid`,
        [limsOrderIds]
      ).catch(() => [])
    : [];

  // ── Step 4: Standalone samples not in any known order ────────────────────
  const standaloneSamples = await query<{
    sampleid: string;
    labcategory: string;
    sampletype: string;
    collectiondate: string;
  }>(
    `SELECT DISTINCT ON (s.sampleid)
       s.sampleid::text                    AS sampleid,
       COALESCE(s.labcategory, '')         AS labcategory,
       COALESCE(s.sampletype, '')          AS sampletype,
       s.collectiondate::text              AS collectiondate
     FROM accession_samples s
     WHERE (s.patientid = ANY($1::text[]) OR s.subjectidentifier = ANY($1::text[]) OR s.ehrid = ANY($1::text[]))
       AND (s.orderid IS NULL OR s.orderid::text NOT IN (SELECT unnest($2::text[])))
     ORDER BY s.sampleid`,
    [identifiers, limsOrderIds]
  ).catch(() => []);

  // ── Step 5: test_results for all samples ─────────────────────────────────
  const uniqueSampleIds = Array.from(new Set([
    ...samplesForOrders.map((s) => s.sampleid),
    ...standaloneSamples.map((s) => s.sampleid),
  ]));

  const sampleResults = uniqueSampleIds.length > 0
    ? await query<LabTest & { sample_id: string; sampleType: string }>(
        `SELECT
           tr.resultid::text                         AS id,
           tr.sampleid::text                         AS sample_id,
           tr.testname                               AS name,
           COALESCE(tr.resultvalue, '')              AS result,
           COALESCE(tr.unit, '')                     AS unit,
           COALESCE(tr.referencerange, '')           AS "normalRange",
           COALESCE(tr.isabormal, false)             AS "isAbnormal",
           COALESCE(tr.status, 'pending')            AS status,
           tr.analyzeddate                           AS date,
           COALESCE(s.sampletype, '')                AS "sampleType"
         FROM test_results tr
         JOIN accession_samples s ON s.sampleid = tr.sampleid
         WHERE tr.sampleid = ANY($1::uuid[])
         ORDER BY s.sampletype, tr.testname ASC`,
        [uniqueSampleIds]
      ).catch(() => [])
    : [];

  // ── Step 6: Build LabOrder objects ────────────────────────────────────────
  const output: LabOrder[] = [];

  for (const lo of limsOrders) {
    const orderTests   = limsOrderTests.filter((t) => t.orderid === lo.orderid);
    const orderSamples = samplesForOrders.filter((s) => s.orderid === lo.orderid);
    const orderSampleIds = new Set(orderSamples.map((s) => s.sampleid));
    const trResults = sampleResults.filter((r) => orderSampleIds.has(r.sample_id));

    let allTests: LabTest[];

    if (orderTests.length > 0) {
      // Use lims_order_tests as the primary source of test names and status.
      // Enrich with test_results where a matching result row exists (by name).
      allTests = orderTests.map((t) => {
        const enriched = trResults.find(
          (r) => r.name?.toLowerCase() === t.testname.toLowerCase()
        );
        const hasResult = !!(t.resultvalue || enriched?.result);
        return {
          id:          t.ordertestid,
          name:        t.testname,
          result:      t.resultvalue || enriched?.result || '',
          unit:        t.resultunit  || enriched?.unit   || '',
          normalRange: enriched?.normalRange || '',
          isAbnormal:  enriched?.isAbnormal  || false,
          status:      hasResult ? 'completed' as const : 'pending' as const,
          date:        enriched?.date,
          sampleType:  enriched?.sampleType,
        };
      });
    } else {
      // Fallback: build from samples + test_results (no lims_order_tests rows)
      const samplesWithResults = new Set(trResults.map((r) => r.sample_id));
      const syntheticPending: LabTest[] = orderSamples
        .filter((s) => !samplesWithResults.has(s.sampleid))
        .map((s) => ({
          id:          `pending-${s.sampleid}`,
          name:        s.sampletype || s.labcategory || 'Sample',
          result:      '',
          unit:        '',
          normalRange: '',
          isAbnormal:  false,
          status:      'pending' as const,
          sampleType:  s.sampletype,
        }));

      if (orderSamples.length === 0) {
        syntheticPending.push({
          id:          `pending-order-${lo.orderid}`,
          name:        'Awaiting sample collection',
          result:      '',
          unit:        '',
          normalRange: '',
          isAbnormal:  false,
          status:      'pending' as const,
        });
      }

      allTests = [...trResults, ...syntheticPending];
    }

    const pendingTests   = allTests.filter((t) => !t.result || t.result === '');
    const completedTests = allTests.filter((t) => !!t.result && t.result !== '');
    const status = completedTests.length === 0
      ? 'pending' as const
      : pendingTests.length === 0
        ? 'completed' as const
        : 'partial' as const;

    const sampleTypes = Array.from(new Set(orderSamples.map((s) => s.sampletype).filter(Boolean))).join(', ');
    const category    = Array.from(new Set(orderSamples.map((s) => s.labcategory).filter(Boolean))).join(', ');
    const hospitalName = category
      ? `${category}${sampleTypes ? ` — ${sampleTypes}` : ''}`
      : sampleTypes || lo.clinicalIndication || '';

    output.push({
      id:           lo.orderid,
      orderDate:    lo.orderDate,
      doctorName:   lo.doctorName,
      hospitalName,
      status,
      tests:        allTests,
      pendingTests,
      completedTests,
    });
  }

  // Standalone samples (no lims_order row)
  const standaloneGroupMap = new Map<string, typeof standaloneSamples>();
  for (const s of standaloneSamples) {
    const key = `${s.labcategory || 'lab'}-${s.collectiondate?.slice(0, 10) ?? 'nodate'}`;
    const g = standaloneGroupMap.get(key) ?? [];
    g.push(s);
    standaloneGroupMap.set(key, g);
  }

  standaloneGroupMap.forEach((groupSamples, groupKey) => {
    const groupSampleIds     = new Set(groupSamples.map((s) => s.sampleid));
    const groupResults       = sampleResults.filter((r) => groupSampleIds.has(r.sample_id));
    const samplesWithResults = new Set(groupResults.map((r) => r.sample_id));

    const syntheticPending: LabTest[] = groupSamples
      .filter((s) => !samplesWithResults.has(s.sampleid))
      .map((s) => ({
        id:          `pending-${s.sampleid}`,
        name:        s.sampletype || s.labcategory || 'Sample',
        result:      '',
        unit:        '',
        normalRange: '',
        isAbnormal:  false,
        status:      'pending' as const,
        sampleType:  s.sampletype,
      }));

    const allTests       = [...groupResults, ...syntheticPending];
    const pendingTests   = allTests.filter((t) => !t.result || t.result === '');
    const completedTests = allTests.filter((t) => !!t.result && t.result !== '');
    const status = completedTests.length === 0
      ? 'pending' as const
      : pendingTests.length === 0
        ? 'completed' as const
        : 'partial' as const;

    const sampleTypes = Array.from(new Set(groupSamples.map((s) => s.sampletype).filter(Boolean))).join(', ');
    const category    = groupSamples[0].labcategory;

    output.push({
      id:           groupKey,
      orderDate:    groupSamples[0].collectiondate,
      doctorName:   '',
      hospitalName: category ? `${category}${sampleTypes ? ` — ${sampleTypes}` : ''}` : sampleTypes,
      status,
      tests:        allTests,
      pendingTests,
      completedTests,
    });
  });

  return output.sort((a, b) =>
    new Date(b.orderDate ?? 0).getTime() - new Date(a.orderDate ?? 0).getTime()
  );
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

export async function getDispensedMeds(nationalId: string): Promise<DispensedMed[]> {
  const [pharmacyResult, hospitalResult] = await Promise.allSettled([
    query<{
      id: string; drugName: string; quantity: number | null;
      dosage: string; dispensedAt: string; dispensedBy: string; notes: string;
    }>(
      `SELECT
         po.orderid::text                                  AS id,
         COALESCE(poi.drugname, '')                        AS "drugName",
         COALESCE(poi.quantitydispensed, poi.quantity)     AS quantity,
         COALESCE(poi.dosage, '')                          AS dosage,
         COALESCE(po.dispensedat, po.updatedat)::text      AS "dispensedAt",
         COALESCE(po.prescribername, '')                   AS "dispensedBy",
         COALESCE(po.notes, '')                            AS notes
       FROM pharmacy_orders po
       JOIN patients p ON p.patientid = po.patientid
       LEFT JOIN pharmacy_order_items poi ON poi.orderid = po.orderid
       WHERE p.nationalid = $1
         AND po.status IN ('DISPENSED', 'PARTIALLY_DISPENSED')
       ORDER BY COALESCE(po.dispensedat, po.updatedat) DESC
       LIMIT 100`,
      [nationalId]
    ),
    query<{
      id: string; drugName: string; quantity: number | null;
      dosage: string; dispensedAt: string; dispensedBy: string; notes: string;
    }>(
      `SELECT
         hd.id::text                                       AS id,
         COALESCE(hi.name, hi.generic_name, '')            AS "drugName",
         hd.quantity,
         COALESCE(hi.strength, '')                         AS dosage,
         hd.createdat::text                                AS "dispensedAt",
         COALESCE(hd.dispensed_by, '')                     AS "dispensedBy",
         COALESCE(hd.notes, hd.reason, '')                 AS notes
       FROM hospital_dispenses hd
       LEFT JOIN hospital_items hi ON hi.id = hd.item_id
       WHERE hd.patient_ref = $1
       ORDER BY hd.createdat DESC
       LIMIT 100`,
      [nationalId]
    ),
  ]);

  const pharmacy: DispensedMed[] =
    pharmacyResult.status === 'fulfilled'
      ? pharmacyResult.value.map((r) => ({ ...r, source: 'Pharmacy' as const }))
      : [];

  const hospital: DispensedMed[] =
    hospitalResult.status === 'fulfilled'
      ? hospitalResult.value.map((r) => ({ ...r, source: 'Hospital' as const }))
      : [];

  return [...pharmacy, ...hospital].sort(
    (a, b) => new Date(b.dispensedAt).getTime() - new Date(a.dispensedAt).getTime()
  );
}
