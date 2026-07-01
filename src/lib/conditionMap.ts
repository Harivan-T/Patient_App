// Maps regex patterns against a diagnosis name string → ICD-10 code.
// Used when EHRbase did NOT supply a coded diagnosis (DB free-text patients whose
// patient_medical_information.chronicdiseases column has plain text).
//
// ⚠️  CLINICIAN REVIEW REQUIRED before any clinical use.
//     Patterns are intentionally broad to catch common spellings and misspellings.
//     Add new entries at the bottom; do NOT reorder existing ones (first match wins).

export const CONDITION_CODE_MAP: Array<{ pattern: RegExp; code: string }> = [
  // ── Type 2 Diabetes ──────────────────────────────────────────────────────────
  { pattern: /diabet/i,                                        code: 'E11' },
  { pattern: /السكر(?:ي|ي النوع)?|نوع.*2|سكري|مرض السكر/i,    code: 'E11' }, // Arabic
  { pattern: /شەکر|دیابەتی|دیابێت/i,                          code: 'E11' }, // Kurdish

  // ── Hypertension ─────────────────────────────────────────────────────────────
  { pattern: /hypertens|high blood press/i,                    code: 'I10' },
  { pattern: /blood\s*pr[ea][e]?s+ure/i,                       code: 'I10' }, // "blood pressure" / "blood preasure" typo
  { pattern: /ارتفاع.*ضغط|ضغط.*دم.*مرتف|ضغط عال|ضغط الدم/i,  code: 'I10' }, // Arabic
  { pattern: /تانسیۆنی بەرز|فشاری خوێن/i,                     code: 'I10' }, // Kurdish

  // ── Asthma ───────────────────────────────────────────────────────────────────
  { pattern: /asthm/i,                                         code: 'J45' },
  { pattern: /الربو|ربو/i,                                     code: 'J45' }, // Arabic
  { pattern: /ئەستما|تەنگەنەفەس/i,                             code: 'J45' }, // Kurdish

  // ── Hyperlipidaemia / High Cholesterol ───────────────────────────────────────
  { pattern: /hyperlipi|cholesterol|dyslipid/i,                code: 'E78' },
  { pattern: /كوليستيرول|شحوم الدم|ارتفاع الدهون/i,            code: 'E78' }, // Arabic
  { pattern: /کۆلستیرۆل|چەوری خوێن/i,                         code: 'E78' }, // Kurdish

  // ── Chronic Kidney Disease ────────────────────────────────────────────────────
  { pattern: /chronic kidney|CKD|renal (fail|insuff)|nephrop/i, code: 'N18' },
  { pattern: /قصور كلوي|مرض الكلى المزمن|الكلى المزمن/i,       code: 'N18' }, // Arabic
  { pattern: /نەخۆشی گورچیلەی مزمن|گورچیلەی مزمن/i,            code: 'N18' }, // Kurdish

  // ── Hypothyroidism ────────────────────────────────────────────────────────────
  { pattern: /hypothyroid/i,                                   code: 'E03' },
  { pattern: /قصور.*درقية|كسل الغدة الدرقية/i,                 code: 'E03' }, // Arabic

  // ── Coronary Artery Disease / General Heart Disease ──────────────────────────
  { pattern: /coronary artery|ischaemi[ac] heart|ischemi[ac] heart/i, code: 'I25' },
  { pattern: /heart\s*(problem|issue|disease|condition|trouble)/i,     code: 'I25' }, // vague "heart problems"
  { pattern: /أمراض القلب التاجية|شريان تاجي/i,                code: 'I25' }, // Arabic
  { pattern: /کێشەی دڵ|نەخۆشی دڵ/i,                           code: 'I25' }, // Kurdish

  // ── Heart Failure ─────────────────────────────────────────────────────────────
  { pattern: /heart failure/i,                                  code: 'I50' },
  { pattern: /فشل القلب|قصور القلب/i,                           code: 'I50' }, // Arabic

  // ── COPD ─────────────────────────────────────────────────────────────────────
  { pattern: /COPD|chronic obstruct.*pulmon/i,                  code: 'J44' },
  { pattern: /انسداد رئوي مزمن/i,                               code: 'J44' }, // Arabic
];

/** Returns the first matching ICD-10 code for a diagnosis name, or null if no match. */
export function resolveCodeFromName(name: string): string | null {
  for (const { pattern, code } of CONDITION_CODE_MAP) {
    if (pattern.test(name)) return code;
  }
  return null;
}
