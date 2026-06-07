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

  const specialTables = await q(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public'
       AND (table_name ILIKE '%diagno%' OR table_name ILIKE '%vital%' OR table_name ILIKE '%encounter%' OR table_name ILIKE '%visit%' OR table_name ILIKE '%clinical%')
     ORDER BY table_name`
  ).catch(() => []);
  results['specialTableSearch'] = specialTables;

  // Direct: test_results overview
  results['test_results_total_count'] = await q(`SELECT COUNT(*) AS cnt FROM test_results`).catch((e) => ({ error: String(e) }));
  results['test_results_recent_5'] = await q(
    `SELECT resultid, sampleid, testcode, testname, resultvalue, status, workspaceid, createdat FROM test_results ORDER BY createdat DESC LIMIT 5`
  ).catch((e) => ({ error: String(e) }));

  if (patientId) {
    const accs = await q(
      `SELECT sampleid, samplenumber, labcategory, sampletype, currentstatus, collectiondate
       FROM accession_samples WHERE patientid = $1 ORDER BY collectiondate DESC LIMIT 10`,
      [patientId]
    ).catch((e) => ({ error: String(e) }));
    results['accession_samples_for_patient'] = accs;

    const sampleIds = Array.isArray(accs)
      ? (accs as { sampleid: string }[]).map((s) => s.sampleid)
      : [];

    if (sampleIds.length > 0) {
      results['test_results_for_patient'] = await q(
        `SELECT tr.resultid, tr.sampleid, tr.testcode, tr.testname, tr.resultvalue, tr.status, tr.flag, tr.iscritical, tr.analyzeddate
         FROM test_results tr
         WHERE tr.sampleid = ANY($1::uuid[])
         ORDER BY tr.testname`,
        [sampleIds]
      ).catch((e) => ({ error: String(e) }));

      results['test_results_via_accessionsampleid'] = await q(
        `SELECT tr.resultid, tr.accessionsampleid, tr.testcode, tr.testname, tr.resultvalue, tr.status
         FROM test_results tr
         WHERE tr.accessionsampleid = ANY($1::uuid[])
         ORDER BY tr.testname`,
        [sampleIds]
      ).catch((e) => ({ error: String(e) }));
    } else {
      results['test_results_for_patient'] = { note: 'no accession_samples found for patient' };
    }
  }

  return NextResponse.json(results, { status: 200 });
}
