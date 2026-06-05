import { NextResponse } from 'next/server';
import { Pool } from 'pg';

function getPool() {
  const url = (process.env.DATABASE_URL ?? '').replace(/[&?]channel_binding=[^&]*/g, '');
  return new Pool({ connectionString: url, max: 3, connectionTimeoutMillis: 15000, ssl: { rejectUnauthorized: false } });
}

async function q(sql: string, params?: unknown[]) {
  const pool = getPool();
  try { return (await pool.query(sql, params)).rows; }
  finally { await pool.end(); }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const nationalId = url.searchParams.get('id') ?? '199012121212';

  const patient = await q(
    `SELECT patientid, nationalid, firstname, lastname, ehrid FROM patients WHERE nationalid = $1 LIMIT 1`,
    [nationalId]
  ).then(r => r[0]).catch(() => null);

  const patientId = (patient as { patientid?: string })?.patientid;
  const ehrId = (patient as { ehrid?: string })?.ehrid;

  const results: Record<string, unknown> = { patient, patientId, ehrId };

  // Check the specific tables missed in previous scan
  const targetTables = [
    'openehr_medications',
    'hospital_history',
    'controlled_drug_log',
    'worklist_items',
    'worklists',
    'accession_samples',
    'samples',
  ];

  for (const tbl of targetTables) {
    try {
      const cols = await q(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
        [tbl]
      );
      const colNames = (cols as {column_name:string}[]).map(c => c.column_name);

      // Try to find rows for this patient
      const patientCols = colNames.filter(c => ['patientid','patient_id','nationalid','national_id','subjectidentifier','subject_id','ehrid','ehr_id'].includes(c.toLowerCase()));
      let rows: unknown[] = [];
      for (const col of patientCols) {
        rows = await q(`SELECT * FROM "${tbl}" WHERE "${col}" IN ($1, $2, $3) LIMIT 5`, [patientId, nationalId, ehrId ?? '']).catch(() => []);
        if (rows.length > 0) break;
      }
      if (rows.length === 0) {
        rows = await q(`SELECT * FROM "${tbl}" LIMIT 3`).catch(() => []);
      }
      results[tbl] = { columns: colNames, patientCols, rows };
    } catch (e) {
      results[tbl] = { error: String(e) };
    }
  }

  // Also look for ANY table with 'diagno' or 'vital' in name
  const specialTables = await q(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public'
       AND (table_name ILIKE '%diagno%' OR table_name ILIKE '%vital%' OR table_name ILIKE '%encounter%' OR table_name ILIKE '%visit%' OR table_name ILIKE '%clinical%')
     ORDER BY table_name`
  ).catch(() => []);
  results['specialTableSearch'] = specialTables;

  // Check if openehr_medications has diagnoses columns or is just meds
  try {
    const oemCols = await q(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='openehr_medications' ORDER BY ordinal_position`
    );
    results['openehr_medications_schema'] = (oemCols as {column_name:string}[]).map(c => c.column_name);
  } catch { results['openehr_medications_schema'] = 'table not found'; }

  // Check hospital_history columns
  try {
    const hhCols = await q(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='hospital_history' ORDER BY ordinal_position`
    );
    const hhRows = patientId ? await q(`SELECT * FROM hospital_history WHERE patientid=$1 OR patient_id=$1 LIMIT 5`, [patientId]).catch(() => []) : [];
    results['hospital_history_detail'] = { columns: (hhCols as {column_name:string}[]).map(c => c.column_name), rows: hhRows };
  } catch (e) { results['hospital_history_detail'] = { error: String(e) }; }

  return NextResponse.json(results, { status: 200 });
}
