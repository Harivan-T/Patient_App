import { NextRequest, NextResponse } from 'next/server';
import { query, getPatientById, getPatientMedicalInfo, parseDiagnoses } from '@/lib/epr';
import { getSessionFromCookies } from '@/lib/auth';
import { getDiagnoses } from '@/lib/ehrbase';
import { resolveCodeFromName } from '@/lib/conditionMap';

export const dynamic = 'force-dynamic';

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

// ── Generic keywords (patients with no chronic conditions) ─────────────────────
const GENERIC_KEYWORDS: Record<Section, Record<string, string | null>> = {
  health: { en: null, ar: null, ku: null },
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

// ── Condition-specific health keywords per ICD-10 code ─────────────────────────
// ⚠️  CLINICIAN REVIEW REQUIRED — terms are intentionally broad for news coverage.
const CONDITION_HEALTH_KW: Record<string, Record<string, string>> = {
  E11: {
    en: 'diabetes OR "blood sugar" OR insulin OR diabetic',
    ar: 'السكري OR "سكر الدم" OR الأنسولين OR "مرض السكر"',
    ku: 'دیابەت OR "شەکری خوێن" OR ئینسولین',
  },
  I10: {
    en: 'hypertension OR "blood pressure" OR "heart health"',
    ar: '"ضغط الدم" OR "ضغط مرتفع" OR "صحة القلب"',
    ku: '"تانسیۆنی بەرز" OR "فشاری خوێن"',
  },
  J45: {
    en: 'asthma OR "respiratory health" OR "lung health"',
    ar: 'الربو OR "الجهاز التنفسي" OR "صحة الرئة"',
    ku: 'ئەستما OR "تەندروستی هەناسە"',
  },
  E78: {
    en: 'cholesterol OR "heart health" OR cardiovascular',
    ar: 'كوليسترول OR "صحة القلب" OR "الدهون في الدم"',
    ku: 'کۆلستیرۆل OR "تەندروستی دڵ"',
  },
  N18: {
    en: '"kidney health" OR "kidney disease" OR renal',
    ar: '"صحة الكلى" OR "أمراض الكلى"',
    ku: '"تەندروستی گورچیلە" OR "نەخۆشی گورچیلە"',
  },
  E03: {
    en: 'thyroid OR hypothyroidism OR "thyroid health"',
    ar: '"الغدة الدرقية" OR "قصور الدرقية"',
    ku: 'تایرۆید OR "غدەی تایرۆید"',
  },
  I25: {
    en: '"heart disease" OR coronary OR cardiovascular',
    ar: '"أمراض القلب" OR "الشريان التاجي"',
    ku: '"نەخۆشی دڵ" OR "تەندروستی دڵ"',
  },
  I50: {
    en: '"heart failure" OR "cardiac health" OR "heart health"',
    ar: '"فشل القلب" OR "صحة القلب"',
    ku: '"کەموکوڕی دڵ" OR "تەندروستی دڵ"',
  },
  J44: {
    en: 'COPD OR "pulmonary disease" OR "lung health"',
    ar: '"الانسداد الرئوي" OR "أمراض الرئة"',
    ku: '"نەخۆشی سیناسەرە" OR "تەندروستی سیناسەرە"',
  },
};

// ── Condition-specific food keywords ──────────────────────────────────────────
const CONDITION_FOOD_KW: Record<string, Record<string, string>> = {
  E11: {
    en: '"diabetes diet" OR "diabetic food" OR "low sugar" OR "blood sugar diet"',
    ar: '"نظام السكري" OR "أطعمة السكري" OR "نظام غذائي لمرضى السكر"',
    ku: '"خواردنی دیابەت" OR "خواردنی کەم شەکر"',
  },
  I10: {
    en: '"low sodium" OR "DASH diet" OR "blood pressure diet" OR "heart healthy food"',
    ar: '"نظام ضغط الدم" OR "قليل الصوديوم" OR "غذاء صحي للقلب"',
    ku: '"خواردنی تانسیۆن" OR "کەم خوێ"',
  },
  J45: {
    en: '"asthma diet" OR "anti-inflammatory food" OR "lung health food"',
    ar: '"نظام غذائي للربو" OR "أطعمة للرئة" OR "غذاء مضاد للالتهاب"',
    ku: '"خواردنی ئەستما" OR "خواردنی هەناسە"',
  },
  E78: {
    en: '"cholesterol diet" OR "heart healthy diet" OR "healthy fats" OR omega-3',
    ar: '"نظام الكوليسترول" OR "دهون صحية" OR "أوميغا 3"',
    ku: '"خواردنی کۆلستیرۆل" OR "چەوری تەندروست"',
  },
  N18: {
    en: '"kidney diet" OR "low potassium food" OR "kidney-friendly"',
    ar: '"نظام غذائي للكلى" OR "أطعمة للكلى"',
    ku: '"خواردنی گورچیلە"',
  },
  E03: {
    en: '"thyroid diet" OR "thyroid health food" OR "iodine rich"',
    ar: '"نظام الغدة الدرقية" OR "أطعمة الغدة الدرقية"',
    ku: '"خواردنی تایرۆید"',
  },
  I25: {
    en: '"cardiac diet" OR "heart healthy food" OR "cardiovascular diet"',
    ar: '"نظام القلب" OR "أطعمة صحية للقلب"',
    ku: '"خواردنی دڵ"',
  },
  I50: {
    en: '"heart failure diet" OR "low sodium heart" OR "cardiac diet"',
    ar: '"نظام فشل القلب" OR "غذاء صحي للقلب" OR "قليل الصوديوم"',
    ku: '"خواردنی دڵ"',
  },
  J44: {
    en: '"COPD diet" OR "lung health food" OR "anti-inflammatory diet"',
    ar: '"نظام الانسداد الرئوي" OR "أطعمة للرئة"',
    ku: '"خواردنی سیناسەرە"',
  },
};

// ── Condition-specific sports/exercise keywords ────────────────────────────────
const CONDITION_SPORTS_KW: Record<string, Record<string, string>> = {
  E11: {
    en: '"exercise for diabetes" OR "diabetes workout" OR "walking blood sugar"',
    ar: '"رياضة السكري" OR "تمارين السكري" OR "المشي وسكر الدم"',
    ku: '"وەرزش بۆ دیابەت" OR "پێپیاوکردن و شەکری خوێن"',
  },
  I10: {
    en: '"exercise blood pressure" OR "hypertension workout" OR "walking heart"',
    ar: '"رياضة ضغط الدم" OR "تمارين الضغط" OR "المشي والقلب"',
    ku: '"وەرزش بۆ تانسیۆن" OR "پێپیاوکردن و دڵ"',
  },
  J45: {
    en: '"exercise for asthma" OR "breathing exercises" OR "safe sport asthma"',
    ar: '"رياضة الربو" OR "تمارين التنفس" OR "رياضة آمنة للربو"',
    ku: '"وەرزش بۆ ئەستما" OR "ڕاهێنانی هەناسەدان"',
  },
  E78: {
    en: '"exercise for cholesterol" OR "cardio cholesterol" OR "aerobic heart health"',
    ar: '"رياضة الكوليسترول" OR "تمارين القلب" OR "الكارديو للكوليسترول"',
    ku: '"وەرزش بۆ کۆلستیرۆل" OR "وەرزشی دڵ"',
  },
  N18: {
    en: '"exercise kidney disease" OR "safe workout CKD" OR "kidney health exercise"',
    ar: '"رياضة أمراض الكلى" OR "تمارين آمنة للكلى"',
    ku: '"وەرزش بۆ گورچیلە"',
  },
  E03: {
    en: '"exercise for thyroid" OR "thyroid workout" OR "thyroid health fitness"',
    ar: '"رياضة الغدة الدرقية" OR "تمارين الدرقية"',
    ku: '"وەرزش بۆ تایرۆید"',
  },
  I25: {
    en: '"cardiac exercise" OR "heart disease workout" OR "safe exercise heart"',
    ar: '"رياضة أمراض القلب" OR "تمارين آمنة للقلب"',
    ku: '"وەرزشی دڵ" OR "وەرزشی سەلامەتی دڵ"',
  },
  I50: {
    en: '"heart failure exercise" OR "cardiac rehabilitation" OR "gentle exercise heart"',
    ar: '"تمارين فشل القلب" OR "إعادة تأهيل قلبي"',
    ku: '"وەرزشی کەموکوڕی دڵ"',
  },
  J44: {
    en: '"COPD exercise" OR "pulmonary rehab" OR "breathing exercise COPD"',
    ar: '"رياضة الانسداد الرئوي" OR "إعادة تأهيل رئوي"',
    ku: '"وەرزشی سیناسەرە" OR "ڕاهێنانی هەناسەدان"',
  },
};

const KW_MAP: Record<Section, Record<string, Record<string, string>>> = {
  health: CONDITION_HEALTH_KW,
  food:   CONDITION_FOOD_KW,
  sports: CONDITION_SPORTS_KW,
};

// Build a search keyword for a section from condition codes + locale.
// Combines up to 2 conditions to stay within NewsData query limits.
function buildConditionKeyword(section: Section, codes: string[], locale: string): string | null {
  const map = KW_MAP[section];
  const terms: string[] = [];
  for (const code of codes.slice(0, 2)) {
    const kw = map[code]?.[locale] ?? map[code]?.['en'];
    if (kw) terms.push(kw);
  }
  return terms.length > 0 ? terms.join(' OR ') : null;
}

// ── Silently resolve the logged-in patient's chronic ICD-10 codes ──────────────
async function getChronicCodes(): Promise<string[]> {
  try {
    const session = await getSessionFromCookies();
    if (!session) return [];
    const patient = await getPatientById(session.patientId).catch(() => null);
    if (!patient) return [];
    const medInfo   = await getPatientMedicalInfo(session.patientId).catch(() => null);
    let diagnoses   = parseDiagnoses(medInfo);
    if (patient.ehrId) {
      try {
        const ehrDx = await getDiagnoses(patient.ehrId);
        if (ehrDx.length > 0) diagnoses = ehrDx;
      } catch { /* EHRbase unreachable */ }
    }
    const codes = Array.from(new Set(
      diagnoses
        .filter((d) => d.status === 'chronic' || d.status === 'active')
        .map((d) => (d.code?.trim()) || resolveCodeFromName(d.name) || resolveCodeFromName((d as {description?: string}).description ?? ''))
        .filter((c): c is string => Boolean(c)),
    )).sort();
    return codes;
  } catch {
    return [];
  }
}

// Language fallback chain: ku → ar → en, ar → en
const LANG_FALLBACK: Record<string, string[]> = {
  ku: ['ar', 'en'],
  ar: ['en'],
  en: [],
};

// ── Table setup ────────────────────────────────────────────────────────────────

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
  // Condition-profile slot — '' for patients with no chronic conditions
  await query(
    `ALTER TABLE daily_insights ADD COLUMN IF NOT EXISTS condition_key TEXT NOT NULL DEFAULT ''`,
  ).catch(() => {});
  // Replace old index (no condition_key) with one that includes it
  await query(`DROP INDEX IF EXISTS daily_insights_uix`).catch(() => {});
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS daily_insights_cond_uix
    ON daily_insights (category, language, fetched_date, condition_key)
  `).catch(() => {});
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Cache read/write ───────────────────────────────────────────────────────────

async function getCached(
  section: Section,
  language: string,
  date: string,
  conditionKey: string,
): Promise<DailyInsight | null> {
  const rows = await query<DailyInsight>(
    `SELECT category, title, source, snippet, url, image_url
       FROM daily_insights
      WHERE category = $1 AND language = $2 AND fetched_date = $3 AND condition_key = $4
      LIMIT 1`,
    [section, language, date, conditionKey],
  );
  return rows[0] ?? null;
}

async function upsert(
  insight: DailyInsight,
  language: string,
  date: string,
  conditionKey: string,
) {
  await query(
    `INSERT INTO daily_insights
       (category, language, title, source, snippet, url, image_url, fetched_date, condition_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (category, language, fetched_date, condition_key) DO NOTHING`,
    [insight.category, language, insight.title, insight.source,
     insight.snippet, insight.url, insight.image_url, date, conditionKey],
  );
}

// ── Arabic political-content filter ───────────────────────────────────────────
const AR_SKIP_TOKENS = [
  'وزير', 'الوزير', 'حكومة', 'برلمان', 'انتخاب', 'مجلس النواب', 'سياسة', 'رئيس الوزراء',
  'تفسير حلم', 'تفسير الأحلام', 'ابن سيرين', 'رؤيا',
  'أبراج', 'الحظ', 'الطالع', 'برج',
  'فنانة', 'ممثلة', 'مشاهير', 'نجمة',
];

function isIrrelevantAr(title: string, snippet: string): boolean {
  const text = title + ' ' + snippet;
  return AR_SKIP_TOKENS.some((tok) => text.includes(tok));
}

// ── NewsData fetch ─────────────────────────────────────────────────────────────

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
      if (url   && exclude.has(url))   continue;
      if (title && exclude.has(title)) continue;
      if (language === 'ar' && isIrrelevantAr(title, article.description ?? '')) continue;
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

// ── Per-section fetch (locale + language fallback chain) ───────────────────────

async function fetchSection(
  section: Section,
  locale: string,
  exclude: Set<string>,
  chronicCodes: string[],
): Promise<DailyInsight | null> {
  // Pick keyword: condition-specific if patient has chronic conditions, else generic
  const getKeyword = (lang: string): string | null => {
    if (chronicCodes.length > 0) {
      const condKw = buildConditionKeyword(section, chronicCodes, lang);
      if (condKw) return condKw;
    }
    return GENERIC_KEYWORDS[section][lang] ?? null;
  };

  const hit = await fetchFromNewsData(section, locale, getKeyword(locale), exclude);
  if (hit) return hit;

  for (const fallbackLang of (LANG_FALLBACK[locale] ?? [])) {
    const fallbackHit = await fetchFromNewsData(section, fallbackLang, getKeyword(fallbackLang), exclude);
    if (fallbackHit) return fallbackHit;
  }
  return null;
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  await ensureTable();

  const locale = req.nextUrl.searchParams.get('locale') ?? 'en';
  const bust   = req.nextUrl.searchParams.get('bust') === 'true';
  const today  = todayUTC();

  if (bust) {
    await query(`DELETE FROM daily_insights WHERE fetched_date = $1`, [today]).catch(() => {});
  }

  // Resolve patient's chronic conditions for keyword personalization
  const chronicCodes = await getChronicCodes();
  const conditionKey = chronicCodes.join(','); // '' = no conditions = generic news


  const result: Record<Section, DailyInsight | null> = { health: null, food: null, sports: null };
  const seen = new Set<string>();

  for (const section of SECTIONS) {
    const cached = await getCached(section, locale, today, conditionKey);
    if (cached) {
      result[section] = cached;
      if (cached.url)   seen.add(cached.url);
      if (cached.title) seen.add(cached.title);
      continue;
    }
    const fresh = await fetchSection(section, locale, seen, chronicCodes);
    if (fresh) {
      await upsert(fresh, locale, today, conditionKey);
      result[section] = fresh;
      if (fresh.url)   seen.add(fresh.url);
      if (fresh.title) seen.add(fresh.title);
    }
  }

  return NextResponse.json(result);
}
