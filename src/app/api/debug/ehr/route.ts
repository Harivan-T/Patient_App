import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const EHRBASE_URL = process.env.EHRBASE_URL!;
  const EHRBASE_USER = process.env.EHRBASE_USER!;
  const EHRBASE_PASSWORD = process.env.EHRBASE_PASSWORD!;
  const EHRBASE_API_KEY = process.env.EHRBASE_API_KEY ?? '';

  const basicCreds = Buffer.from(`${EHRBASE_USER}:${EHRBASE_PASSWORD}`).toString('base64');
  const headers: Record<string, string> = {
    'Authorization': `Basic ${basicCreds}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (EHRBASE_API_KEY) {
    headers['EHRbase-API-Key'] = EHRBASE_API_KEY;
    headers['X-Api-Key'] = EHRBASE_API_KEY;
  }

  const { searchParams } = new URL(request.url);
  const ehrId = searchParams.get('ehrId') ?? '40171d7e-e3e9-4230-9bca-32d82b249b3d';

  const base = `${EHRBASE_URL}/ehrbase/rest/openehr/v1`;
  const results: Record<string, unknown> = { probing_ehr_id: ehrId };

  const get = async (label: string, url: string) => {
    try {
      const r = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const text = await r.text();
      let parsed: unknown = text;
      try { parsed = JSON.parse(text); } catch { /* leave as text */ }
      results[label] = { status: r.status, data: parsed };
    } catch (e) { results[label] = { error: String(e) }; }
  };

  const aql = async (label: string, q: string) => {
    try {
      const r = await fetch(`${base}/query/aql`, {
        method: 'POST', headers, cache: 'no-store', signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ q }),
      });
      const text = await r.text();
      let parsed: unknown = text;
      try { parsed = JSON.parse(text); } catch { /* leave as text */ }
      results[label] = { status: r.status, data: parsed };
    } catch (e) { results[label] = { error: String(e) }; }
  };

  // 1. All compositions — tells us if the result composition is in this EHR at all
  await aql('all_compositions',
    `SELECT
       c/archetype_node_id AS archetype,
       c/name/value        AS name,
       c/uid/value         AS uid,
       c/context/start_time/value AS date
     FROM EHR e[ehr_id/value='${ehrId}'] CONTAINS COMPOSITION c
     ORDER BY c/context/start_time/value DESC
     LIMIT 30`
  );

  // 2. All observations — shows every observation archetype stored for this patient
  await aql('all_observations',
    `SELECT
       obs/archetype_node_id AS obs_archetype,
       obs/name/value        AS obs_name,
       c/uid/value           AS comp_uid,
       c/archetype_node_id   AS comp_archetype,
       c/context/start_time/value AS date
     FROM EHR e[ehr_id/value='${ehrId}'] CONTAINS COMPOSITION c
       CONTAINS OBSERVATION obs
     ORDER BY c/context/start_time/value DESC
     LIMIT 30`
  );

  // 3. Lab result observation without CLUSTER — confirms if obs archetype matches
  await aql('lab_obs_no_cluster',
    `SELECT
       c/uid/value           AS comp_id,
       obs/archetype_node_id AS obs_archetype,
       obs/name/value        AS panel_name,
       c/context/start_time/value AS date,
       c/composer/name       AS reported_by
     FROM EHR e[ehr_id/value='${ehrId}']
       CONTAINS COMPOSITION c
       CONTAINS OBSERVATION obs[openEHR-EHR-OBSERVATION.laboratory_test_result.v1]
     ORDER BY c/context/start_time/value DESC
     LIMIT 20`
  );

  // 4. Lab result WITH cluster — our production query
  await aql('lab_with_cluster',
    `SELECT
       c/uid/value                           AS comp_id,
       obs/name/value                        AS panel_name,
       analyte/items[at0001]/value/value     AS analyte_name,
       analyte/name/value                    AS cluster_name,
       analyte/items[at0024]/value/magnitude AS value_num,
       analyte/items[at0024]/value/units     AS units,
       analyte/items[at0024]/value/value     AS value_text,
       c/context/start_time/value            AS date
     FROM EHR e[ehr_id/value='${ehrId}']
       CONTAINS COMPOSITION c
       CONTAINS OBSERVATION obs[openEHR-EHR-OBSERVATION.laboratory_test_result.v1]
       CONTAINS CLUSTER analyte
     ORDER BY c/context/start_time/value DESC
     LIMIT 50`
  );

  // 5. Broad cluster search — any observation with any cluster in this EHR
  await aql('any_obs_with_cluster',
    `SELECT
       c/uid/value           AS comp_id,
       obs/archetype_node_id AS obs_archetype,
       obs/name/value        AS obs_name,
       cluster/name/value    AS cluster_name,
       cluster/archetype_node_id AS cluster_archetype,
       c/context/start_time/value AS date
     FROM EHR e[ehr_id/value='${ehrId}']
       CONTAINS COMPOSITION c
       CONTAINS OBSERVATION obs
       CONTAINS CLUSTER cluster
     ORDER BY c/context/start_time/value DESC
     LIMIT 30`
  );

  // 6. Search by template ID — the Tibbna-EHR stores results under custom templates
  await aql('find_by_template_v2',
    `SELECT
       e/ehr_id/value AS ehr_id,
       c/uid/value    AS comp_id,
       c/name/value   AS comp_name,
       c/context/start_time/value AS date
     FROM EHR e CONTAINS COMPOSITION c
     WHERE c/archetype_details/template_id/value = 'template_laboratory_report_v2'
     ORDER BY c/context/start_time/value DESC
     LIMIT 10`
  );

  await aql('find_by_template_v1',
    `SELECT
       e/ehr_id/value AS ehr_id,
       c/uid/value    AS comp_id,
       c/name/value   AS comp_name,
       c/context/start_time/value AS date
     FROM EHR e CONTAINS COMPOSITION c
     WHERE c/archetype_details/template_id/value = 'laboratory_report_v1'
     ORDER BY c/context/start_time/value DESC
     LIMIT 10`
  );

  // 7. All distinct observation archetypes across the entire EHRbase database
  await aql('all_obs_archetypes_system_wide',
    `SELECT DISTINCT
       obs/archetype_node_id AS archetype
     FROM EHR e
       CONTAINS COMPOSITION c
       CONTAINS OBSERVATION obs
     LIMIT 50`
  );

  // 8. Cross-EHR search — find which EHR actually has lab results
  await aql('find_lab_result_any_ehr',
    `SELECT
       e/ehr_id/value        AS ehr_id,
       c/uid/value           AS comp_id,
       obs/name/value        AS panel_name,
       c/context/start_time/value AS date,
       c/composer/name       AS reported_by
     FROM EHR e
       CONTAINS COMPOSITION c
       CONTAINS OBSERVATION obs[openEHR-EHR-OBSERVATION.laboratory_test_result.v1]
     ORDER BY c/context/start_time/value DESC
     LIMIT 10`
  );

  // 7. Look up EHR by national ID (subject external ref)
  const nationalId = searchParams.get('nationalId') ?? '199012121212';
  await get('ehr_by_subject_id', `${base}/ehr?subject_id=${nationalId}&subject_namespace=local`);
  await get('ehr_by_subject_id_patients', `${base}/ehr?subject_id=${nationalId}&subject_namespace=patients`);

  // 8. Fetch raw composition JSON if rawUid supplied
  const rawUid = searchParams.get('rawUid');
  if (rawUid) {
    await get('raw_composition', `${base}/ehr/${ehrId}/composition/${encodeURIComponent(rawUid)}`);
  }

  return NextResponse.json(results, { status: 200 });
}
