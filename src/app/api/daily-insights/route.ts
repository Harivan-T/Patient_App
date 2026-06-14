import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/epr';

export interface DailyInsight {
  category: 'health' | 'food' | 'sports';
  title: string;
  source: string;
  snippet: string;
  url: string;
  image_url: string | null;
}

const SECTIONS = ['health', 'food', 'sports'] as const;
type Section = typeof SECTIONS[number];

// ── Per-section query config ──────────────────────────────────────────────────
// All sections call NewsData with category=health (health-impact framing).
// Keywords narrow each section's focus; null = broad health news (no q param).
// ku has no keyword of its own — the fallback chain applies AR keywords when
// falling back to language=ar.
const KEYWORDS: Record<Section, Record<string, string | null>> = {
  health: {
    en: null,
    ar: null,
    ku: null,
  },
  food: {
    en: 'nutrition OR "healthy eating" OR "healthy food" OR diet',
    ar: 'تغذية OR "غذاء صحي" OR "أكل صحي" OR حمية',
    ku: null,
  },
  sports: {
    en: 'exercise OR fitness OR workout OR "physical activity"',
    ar: 'تمارين OR "لياقة بدنية" OR تمرين OR "نشاط بدني"',
    ku: null,
  },
};

// No country filter — global wellness topics; IQ-specific exercise/diet is too sparse.

// Language fallback chain: ku → ar → en, ar → en
const LANG_FALLBACK: Record<string, string[]> = {
  ku: ['ar', 'en'],
  ar: ['en'],
  en: [],
};

// ── Table setup (unchanged) ───────────────────────────────────────────────────

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS daily_insights (
      category     TEXT NOT NULL,
      language     TEXT NOT NULL DEFAULT 'en',
      title        TEXT NOT NULL,
      source       TEXT NOT NULL,
      snippet      TEXT NOT NULL,
      url          TEXT NOT NULL,
      image_url    TEXT,
      fetched_date DATE NOT NULL
    )
  `);
  await query(
    `ALTER TABLE daily_insights ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en'`,
  ).catch(() => {});
  await query(
    `ALTER TABLE daily_insights DROP CONSTRAINT IF EXISTS daily_insights_pkey`,
  ).catch(() => {});
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS daily_insights_uix
    ON daily_insights (category, language, fetched_date)
  `).catch(() => {});
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Cache read/write (unchanged) ──────────────────────────────────────────────

async function getCached(section: Section, language: string, date: string): Promise<DailyInsight | null> {
  const rows = await query<DailyInsight>(
    `SELECT category, title, source, snippet, url, image_url
       FROM daily_insights
      WHERE category = $1 AND language = $2 AND fetched_date = $3
      LIMIT 1`,
    [section, language, date],
  );
  return rows[0] ?? null;
}

async function upsert(insight: DailyInsight, language: string, date: string) {
  await query(
    `INSERT INTO daily_insights (category, language, title, source, snippet, url, image_url, fetched_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (category, language, fetched_date) DO NOTHING`,
    [insight.category, language, insight.title, insight.source, insight.snippet, insight.url, insight.image_url, date],
  );
}

// ── NewsData fetch ────────────────────────────────────────────────────────────
// Always uses category=health. Iterates the result list and returns the first
// article whose URL and title are not already in `exclude` (dedupe set).

interface RawArticle {
  title?: string;
  link?: string;
  source_id?: string;
  source_name?: string;
  description?: string;
  content?: string;
  image_url?: string | null;
}

async function fetchFromNewsData(
  section: Section,
  language: string,
  q: string | null,
  exclude: Set<string>,
): Promise<DailyInsight | null> {
  const key = process.env.NEWSDATA_API_KEY;
  if (!key || key === 'your_newsdata_api_key') return null;

  try {
    const params = new URLSearchParams({ apikey: key, category: 'health', language });
    if (q) params.set('q', q);

    const res = await fetch(`https://newsdata.io/api/1/latest?${params}`, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    const results: RawArticle[] = data?.results ?? [];

    for (const article of results) {
      const url   = article.link  ?? '';
      const title = article.title ?? '';
      // Skip if this article is already claimed by an earlier section
      if (url   && exclude.has(url))   continue;
      if (title && exclude.has(title)) continue;

      return {
        category: section,
        title,
        source:    article.source_id ?? article.source_name ?? '',
        snippet:   article.description ?? article.content?.slice(0, 200) ?? '',
        url,
        image_url: article.image_url ?? null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Per-section fetch with fallback ───────────────────────────────────────────
// 1. Try the requested locale with its keyword set.
// 2. Walk LANG_FALLBACK, applying each fallback language's own keyword set.
//    (ku food/sport → ar: uses AR keywords, not null)

async function fetchSection(
  section: Section,
  locale: string,
  exclude: Set<string>,
): Promise<DailyInsight | null> {
  const q = KEYWORDS[section][locale] ?? null;
  const hit = await fetchFromNewsData(section, locale, q, exclude);
  if (hit) return hit;

  for (const fallbackLang of (LANG_FALLBACK[locale] ?? [])) {
    const fallbackQ = KEYWORDS[section][fallbackLang] ?? null;
    const fallbackHit = await fetchFromNewsData(section, fallbackLang, fallbackQ, exclude);
    if (fallbackHit) return fallbackHit;
  }

  return null;
}

// ── Handler ───────────────────────────────────────────────────────────────────
// Sections are processed in order (health → food → sports) so each fetch can
// skip URLs/titles already claimed by a previous section (dedupe).

export async function GET(req: NextRequest) {
  await ensureTable();

  const locale = req.nextUrl.searchParams.get('locale') ?? 'en';
  const bust   = req.nextUrl.searchParams.get('bust') === 'true';
  const today  = todayUTC();

  if (bust) {
    await query(`DELETE FROM daily_insights WHERE fetched_date = $1`, [today]).catch(() => {});
  }

  const result: Record<Section, DailyInsight | null> = { health: null, food: null, sports: null };

  // Dedupe set — tracks URLs and titles already used by earlier sections
  const seen = new Set<string>();

  for (const section of SECTIONS) {
    const cached = await getCached(section, locale, today);
    if (cached) {
      result[section] = cached;
      if (cached.url)   seen.add(cached.url);
      if (cached.title) seen.add(cached.title);
      continue;
    }

    const fresh = await fetchSection(section, locale, seen);
    if (fresh) {
      await upsert(fresh, locale, today);
      result[section] = fresh;
      if (fresh.url)   seen.add(fresh.url);
      if (fresh.title) seen.add(fresh.title);
    }
  }

  return NextResponse.json(result);
}
