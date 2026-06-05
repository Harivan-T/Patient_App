import { NextResponse } from 'next/server';

export async function GET() {
  const EHRBASE_URL = process.env.EHRBASE_URL!;
  const EHRBASE_USER = process.env.EHRBASE_USER!;
  const EHRBASE_PASSWORD = process.env.EHRBASE_PASSWORD!;
  const EHRBASE_API_KEY = process.env.EHRBASE_API_KEY ?? '';

  const basicUserPass = Buffer.from(`${EHRBASE_USER}:${EHRBASE_PASSWORD}`).toString('base64');
  const basicUserKey  = Buffer.from(`${EHRBASE_USER}:${EHRBASE_API_KEY}`).toString('base64');
  const basicKeyOnly  = Buffer.from(`${EHRBASE_API_KEY}:`).toString('base64');

  const testUrl = `${EHRBASE_URL}/rest/openehr/v1/query/aql`;
  const minimalAql = JSON.stringify({ q: `SELECT e/ehr_id/value FROM EHR e LIMIT 1` });

  const combos: Array<{ label: string; headers: Record<string, string> }> = [
    {
      label: '1_bearer_apikey',
      headers: { 'Authorization': `Bearer ${EHRBASE_API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    },
    {
      label: '2_basic_user_pass',
      headers: { 'Authorization': `Basic ${basicUserPass}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    },
    {
      label: '3_basic_user_apikey',
      headers: { 'Authorization': `Basic ${basicUserKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    },
    {
      label: '4_bearer_plus_basic',
      headers: {
        'Authorization': `Basic ${basicUserPass}`,
        'EHRbase-API-Key': EHRBASE_API_KEY,
        'X-Api-Key': EHRBASE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    },
    {
      label: '5_xapikey_only',
      headers: { 'X-Api-Key': EHRBASE_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    },
    {
      label: '6_ehrbase_apikey_header_only',
      headers: { 'EHRbase-API-Key': EHRBASE_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    },
    {
      label: '7_bearer_basic_combo',
      headers: {
        'Authorization': `Bearer ${EHRBASE_API_KEY}`,
        'EHRbase-API-Key': EHRBASE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    },
    {
      label: '8_basic_keyonly',
      headers: { 'Authorization': `Basic ${basicKeyOnly}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    },
  ];

  const results: Record<string, unknown> = {
    url: testUrl,
    user: EHRBASE_USER,
    apiKeyPrefix: EHRBASE_API_KEY.slice(0, 4) + '...',
  };

  for (const { label, headers } of combos) {
    try {
      const r = await fetch(testUrl, {
        method: 'POST',
        headers,
        body: minimalAql,
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      const body = await r.text();
      results[label] = { status: r.status, snippet: body.slice(0, 200) };
    } catch (e) {
      results[label] = { error: String(e) };
    }
  }

  return NextResponse.json(results, { status: 200 });
}
