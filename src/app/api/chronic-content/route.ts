import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getPatientById, getPatientMedicalInfo, parseDiagnoses } from '@/lib/epr';
import { getDiagnoses } from '@/lib/ehrbase';
import { query } from '@/lib/epr';
import { resolveCodeFromName } from '@/lib/conditionMap';

export const dynamic = 'force-dynamic';

interface ContentRow {
  id: number;
  condition_code: string;
  condition_key: string;
  language: string;
  category: string | null;
  title: string;
  body_text: string;
  sort_order: number;
}

export interface ContentCard {
  id: number;
  category: string | null;
  title: string;
  bodyText: string;
}

export interface ConditionBlock {
  code: string;        // ICD-10 code (or 'name:<key>' for uncoded fallback)
  name: string;        // patient's own diagnosis name
  cards: ContentCard[];
}

// GET /api/chronic-content?locale=en
// Returns educational content matched to the patient's chronic conditions.
// Flow:
//  1. Load diagnoses with same fallback chain as /api/health (EHRbase → DB)
//  2. Filter to status === 'chronic'
//  3. For each: resolve ICD code (diagnosis.code → conditionMap regex → null)
//  4. Query chronic_disease_content by code (preferred locale then EN fallback)
//  5. For any uncoded diagnosis: match by condition_key substring against name
//  6. Return grouped by condition, deduplicated

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const locale = req.nextUrl.searchParams.get('locale') ?? 'en';
  const locales = locale === 'en' ? ['en'] : [locale, 'en'];

  // ── 1. Load diagnoses ────────────────────────────────────────────────────────
  const patient = await getPatientById(session.patientId).catch(() => null);
  if (!patient) return NextResponse.json([], { status: 200 });

  const medInfo  = await getPatientMedicalInfo(session.patientId).catch(() => null);
  let diagnoses  = parseDiagnoses(medInfo);  // DB fallback (always tagged 'chronic')

  const ehrId = patient.ehrId;
  if (ehrId) {
    try {
      const ehrDiagnoses = await getDiagnoses(ehrId);
      if (ehrDiagnoses.length > 0) diagnoses = ehrDiagnoses;
    } catch { /* EHRbase unreachable — keep DB fallback */ }
  }

  // ── 2. Filter to chronic ─────────────────────────────────────────────────────
  const chronic = diagnoses.filter((d) => d.status === 'chronic');
  if (chronic.length === 0) return NextResponse.json([]);

  // ── 3. Resolve ICD codes ─────────────────────────────────────────────────────
  interface Resolved { name: string; code: string | null }
  const resolved: Resolved[] = chronic.map((d) => ({
    name: d.name,
    code: (d.code && d.code.trim()) ? d.code.trim() : resolveCodeFromName(d.name),
  }));

  const coded   = resolved.filter((r) => r.code !== null);
  const uncoded = resolved.filter((r) => r.code === null);
  const codes   = Array.from(new Set(coded.map((r) => r.code!)));

  // ── 4. Query by code (locale + EN fallback) ──────────────────────────────────
  let codeRows: ContentRow[] = [];
  if (codes.length > 0) {
    codeRows = await query<ContentRow>(
      `SELECT id, condition_code, condition_key, language, category, title, body_text, sort_order
       FROM chronic_disease_content
       WHERE condition_code = ANY($1) AND language = ANY($2)
       ORDER BY condition_code, sort_order`,
      [codes, locales],
    );
  }

  // ── 5. Name fallback for uncoded diagnoses ───────────────────────────────────
  const nameRows: ContentRow[] = [];
  if (uncoded.length > 0) {
    // Load all content for this locale set, then JS-match by condition_key
    const allContent = await query<ContentRow>(
      `SELECT id, condition_code, condition_key, language, category, title, body_text, sort_order
       FROM chronic_disease_content
       WHERE language = ANY($1)
       ORDER BY condition_code, sort_order`,
      [locales],
    );

    for (const diag of uncoded) {
      const nameLower = diag.name.toLowerCase();
      const matches = allContent.filter(
        (c: ContentRow) =>
          nameLower.includes(c.condition_key.toLowerCase()) ||
          c.condition_key.toLowerCase().includes(nameLower),
      );
      nameRows.push(...matches);
    }
  }

  // ── 6. Build ConditionBlock[] ─────────────────────────────────────────────────
  // Pick the preferred-locale row when both locale and 'en' are present for the same item
  function pickBestRows(rows: ContentRow[]): ContentRow[] {
    // Group by (condition_code, sort_order) — prefer preferred locale over 'en'
    const map = new Map<string, ContentRow>();
    for (const row of rows) {
      const key = `${row.condition_code}:${row.sort_order}`;
      const existing = map.get(key);
      if (!existing || row.language !== 'en') {
        map.set(key, row);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.sort_order - b.sort_order);
  }

  // Map code → patient's own diagnosis name
  const codeName = new Map<string, string>();
  for (const r of coded) {
    if (!codeName.has(r.code!)) codeName.set(r.code!, r.name);
  }

  const blocks: ConditionBlock[] = [];

  // Coded conditions — one block per ICD code
  const codeGroups = new Map<string, ContentRow[]>();
  for (const row of codeRows) {
    if (!codeGroups.has(row.condition_code)) codeGroups.set(row.condition_code, []);
    codeGroups.get(row.condition_code)!.push(row);
  }
  for (const [code, rows] of Array.from(codeGroups.entries())) {
    const best = pickBestRows(rows);
    if (best.length === 0) continue;
    blocks.push({
      code,
      name: codeName.get(code) ?? best[0].condition_key,
      cards: best.map((r) => ({ id: r.id, category: r.category, title: r.title, bodyText: r.body_text })),
    });
  }

  // Uncoded conditions — deduplicate by condition_code
  const seen = new Set(codes);
  const nameGroups = new Map<string, { diagName: string; rows: ContentRow[] }>();
  for (const row of nameRows) {
    if (seen.has(row.condition_code)) continue; // already covered by code match
    if (!nameGroups.has(row.condition_code)) {
      const diagName = uncoded.find((d) =>
        d.name.toLowerCase().includes(row.condition_key.toLowerCase()) ||
        row.condition_key.toLowerCase().includes(d.name.toLowerCase()),
      )?.name ?? row.condition_key;
      nameGroups.set(row.condition_code, { diagName, rows: [] });
    }
    nameGroups.get(row.condition_code)!.rows.push(row);
  }
  for (const [code, { diagName, rows }] of Array.from(nameGroups.entries())) {
    const best = pickBestRows(rows);
    if (best.length === 0) continue;
    blocks.push({
      code,
      name: diagName,
      cards: best.map((r) => ({ id: r.id, category: r.category, title: r.title, bodyText: r.body_text })),
    });
  }

  return NextResponse.json(blocks);
}
