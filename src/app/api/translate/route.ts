import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getSessionFromCookies } from '@/lib/auth';
import { query } from '@/lib/db';

const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic',
  ku: 'Kurdish (Sorani)',
};

const MAX_TEXTS = 50;
const MAX_TEXT_LENGTH = 500;

const hashText = (text: string) => createHash('sha256').update(text).digest('hex');

// Cached translations live in translation_cache (locale, source_hash) → translated.
// Failures fall through silently — the cache is an optimization, never a blocker.
// Table creation runs once per process, not per request.
let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = query(
      `CREATE TABLE IF NOT EXISTS translation_cache (
         locale      TEXT NOT NULL,
         source_hash TEXT NOT NULL,
         translated  TEXT NOT NULL,
         created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         PRIMARY KEY (locale, source_hash)
       )`,
    ).then(() => undefined).catch(() => { tableReady = null; });
  }
  return tableReady;
}

async function readCache(locale: string, hashes: string[]): Promise<Map<string, string>> {
  try {
    await ensureTable();
    const r = await query<{ source_hash: string; translated: string }>(
      `SELECT source_hash, translated FROM translation_cache
       WHERE locale = $1 AND source_hash = ANY($2::text[])`,
      [locale, hashes],
    );
    return new Map(r.rows.map((row) => [row.source_hash, row.translated]));
  } catch {
    return new Map();
  }
}

async function writeCache(locale: string, entries: Array<{ hash: string; translated: string }>) {
  try {
    await Promise.all(entries.map(({ hash, translated }) =>
      query(
        `INSERT INTO translation_cache (locale, source_hash, translated)
         VALUES ($1, $2, $3)
         ON CONFLICT (locale, source_hash) DO NOTHING`,
        [locale, hash, translated],
      ),
    ));
  } catch { /* cache write is best-effort */ }
}

async function translateWithAnthropic(texts: string[], langName: string, apiKey: string): Promise<string[]> {
  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Translate the following medical texts to ${langName}. Return ONLY the translations numbered the same way, one per line. Keep medical terms accurate.\n\n${numbered}`,
      }],
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error('Anthropic API error');

  const data = await res.json() as { content: Array<{ text: string }> };
  const raw = data.content?.[0]?.text ?? '';

  // Parse numbered lines back into array; pad with originals if parsing missed any
  const translated = raw
    .split('\n')
    .filter((l: string) => /^\d+\./.test(l.trim()))
    .map((l: string) => l.replace(/^\d+\.\s*/, '').trim());
  return texts.map((orig, i) => translated[i] || orig);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;

  const { texts, locale } = await req.json() as { texts: string[]; locale: string };
  if (
    !Array.isArray(texts) || !texts.length || texts.length > MAX_TEXTS ||
    texts.some((t) => typeof t !== 'string' || t.length > MAX_TEXT_LENGTH) ||
    !locale || !LANG_NAMES[locale]
  ) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ translations: texts });
  }

  const hashes = texts.map(hashText);
  const cached = await readCache(locale, Array.from(new Set(hashes)));

  const missing: Array<{ index: number; text: string; hash: string }> = [];
  texts.forEach((text, index) => {
    if (!cached.has(hashes[index])) missing.push({ index, text, hash: hashes[index] });
  });

  const result = texts.map((text, i) => cached.get(hashes[i]) ?? text);
  if (!missing.length) {
    return NextResponse.json({ translations: result });
  }

  try {
    const translated = await translateWithAnthropic(
      missing.map((m) => m.text),
      LANG_NAMES[locale],
      apiKey,
    );
    missing.forEach((m, j) => { result[m.index] = translated[j]; });
    await writeCache(
      locale,
      missing
        .map((m, j) => ({ hash: m.hash, translated: translated[j] }))
        .filter((e, j) => e.translated !== missing[j].text), // don't cache untranslated fallbacks
    );
    return NextResponse.json({ translations: result });
  } catch {
    // Fallback: cached where available, originals elsewhere
    return NextResponse.json({ translations: result });
  }
}
